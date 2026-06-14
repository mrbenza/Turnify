import type {
  Database,
  NotificationEvent,
  NotificationEventStatus,
} from '@/lib/supabase/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getPushStatusCode,
  type PushPayload,
  sanitizePushError,
  sendWebPush,
} from '@/lib/push/server'

type ServiceClient = SupabaseClient<Database>

export type PushDeliverySubscription = Database['public']['Tables']['push_subscriptions']['Row']

export type PushDeliveryResult = {
  sent: number
  failed: number
  status: NotificationEventStatus
}

export async function sendNotificationEvent(
  serviceClient: ServiceClient,
  event: Pick<NotificationEvent, 'id'>,
  subscriptions: PushDeliverySubscription[],
  payload: PushPayload,
): Promise<PushDeliveryResult> {
  let sent = 0
  let failed = 0

  for (const subscription of subscriptions) {
    const now = new Date().toISOString()
    const { data: delivery } = await serviceClient
      .from('notification_deliveries')
      .insert({
        event_id: event.id,
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        status: 'pending',
        attempts: 1,
        last_attempt_at: now,
      })
      .select()
      .single()

    if (!delivery) {
      failed += 1
      continue
    }

    try {
      const response = await sendWebPush(subscription, payload)
      sent += 1
      await Promise.all([
        serviceClient
          .from('notification_deliveries')
          .update({
            status: 'sent',
            sent_at: now,
            http_status: response.statusCode,
          })
          .eq('id', delivery.id),
        serviceClient
          .from('push_subscriptions')
          .update({
            last_success_at: now,
            failure_count: 0,
          })
          .eq('id', subscription.id),
      ])
    } catch (pushError) {
      failed += 1
      const statusCode = getPushStatusCode(pushError)
      const revoked = statusCode === 404 || statusCode === 410
      await Promise.all([
        serviceClient
          .from('notification_deliveries')
          .update({
            status: revoked ? 'revoked' : 'failed',
            http_status: statusCode,
            error: sanitizePushError(pushError),
          })
          .eq('id', delivery.id),
        serviceClient
          .from('push_subscriptions')
          .update({
            failure_count: subscription.failure_count + 1,
            revoked_at: revoked ? now : subscription.revoked_at,
            revoked_reason: revoked ? 'push_service_gone' : subscription.revoked_reason,
          })
          .eq('id', subscription.id),
      ])
    }
  }

  const status: NotificationEventStatus =
    failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial'

  await serviceClient
    .from('notification_events')
    .update({
      status,
      completed_at: new Date().toISOString(),
    })
    .eq('id', event.id)

  return { sent, failed, status }
}
