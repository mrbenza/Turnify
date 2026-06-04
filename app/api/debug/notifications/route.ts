import { NextResponse } from 'next/server'
import { requireDebugAdmin } from '@/lib/debug-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getPushStatusCode, sanitizePushError, sendWebPush } from '@/lib/push/server'
import { isInternalPushTarget } from '@/lib/push/validation'
import type { PushSubscription } from '@/lib/supabase/types'

function maskEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return `${url.origin}/…${url.pathname.slice(-12)}`
  } catch {
    return `…${endpoint.slice(-16)}`
  }
}

export async function GET() {
  const auth = await requireDebugAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const serviceClient = createServiceClient()
  const [subscriptionsResult, deliveriesResult] = await Promise.all([
    serviceClient
      .from('push_subscriptions')
      .select('id, user_id, endpoint, expiration_time, user_agent, created_at, updated_at, last_seen_at, last_success_at, failure_count, revoked_at')
      .order('last_seen_at', { ascending: false }),
    serviceClient
      .from('notification_deliveries')
      .select('id, event_id, subscription_id, user_id, status, attempts, last_attempt_at, sent_at, http_status, error')
      .order('last_attempt_at', { ascending: false })
      .limit(100),
  ])

  if (subscriptionsResult.error || deliveriesResult.error) {
    return NextResponse.json({ error: 'Impossibile caricare la diagnostica' }, { status: 500 })
  }

  const subscriptions = subscriptionsResult.data ?? []
  const userIds = [...new Set(subscriptions.map((subscription) => subscription.user_id))]
  const eventIds = [...new Set((deliveriesResult.data ?? []).map((delivery) => delivery.event_id))]

  const [usersResult, eventsResult] = await Promise.all([
    userIds.length
      ? serviceClient.from('users').select('id, nome, email, ruolo, attivo, area_id').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? serviceClient.from('notification_events').select('id, event_type, title, body, target_url, created_at, status, completed_at').in('id', eventIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (usersResult.error || eventsResult.error) {
    return NextResponse.json({ error: 'Impossibile completare la diagnostica' }, { status: 500 })
  }

  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, user]))
  const eventMap = new Map((eventsResult.data ?? []).map((event) => [event.id, event]))

  return NextResponse.json({
    users: userIds.map((userId) => ({
      ...userMap.get(userId),
      subscriptions: subscriptions
        .filter((subscription) => subscription.user_id === userId)
        .map((subscription) => ({
          ...subscription,
          endpoint: maskEndpoint(subscription.endpoint),
        })),
    })),
    deliveries: (deliveriesResult.data ?? []).map((delivery) => ({
      ...delivery,
      event: eventMap.get(delivery.event_id) ?? null,
      user: delivery.user_id ? userMap.get(delivery.user_id) ?? null : null,
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireDebugAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { subscriptionIds?: string[]; title?: string; message?: string; url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : ''
  const targetUrl = typeof body.url === 'string' ? body.url.trim() || '/user' : '/user'
  const subscriptionIds = Array.isArray(body.subscriptionIds)
    ? [...new Set(body.subscriptionIds.filter((id): id is string => typeof id === 'string'))].slice(0, 100)
    : []

  if (!title || !message || subscriptionIds.length === 0 || !isInternalPushTarget(targetUrl)) {
    return NextResponse.json({ error: 'Destinatari, titolo, testo o destinazione non validi' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data: subscriptions, error: subscriptionsError } = await serviceClient
    .from('push_subscriptions')
    .select('*')
    .in('id', subscriptionIds)
    .is('revoked_at', null)

  if (subscriptionsError || !subscriptions?.length) {
    return NextResponse.json({ error: 'Nessuna subscription attiva selezionata' }, { status: 400 })
  }

  const { data: event, error: eventError } = await serviceClient
    .from('notification_events')
    .insert({
      event_type: 'test',
      area_id: null,
      month: null,
      year: null,
      publication_number: null,
      created_by: auth.user.id,
      title,
      body: message,
      target_url: targetUrl,
      status: 'sending',
    })
    .select()
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Impossibile creare evento di test' }, { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const subscription of subscriptions as PushSubscription[]) {
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
      const response = await sendWebPush(subscription, { title, body: message, url: targetUrl })
      sent += 1
      await Promise.all([
        serviceClient.from('notification_deliveries').update({
          status: 'sent',
          sent_at: now,
          http_status: response.statusCode,
        }).eq('id', delivery.id),
        serviceClient.from('push_subscriptions').update({
          last_success_at: now,
          failure_count: 0,
        }).eq('id', subscription.id),
      ])
    } catch (pushError) {
      failed += 1
      const statusCode = getPushStatusCode(pushError)
      const revoked = statusCode === 404 || statusCode === 410
      await Promise.all([
        serviceClient.from('notification_deliveries').update({
          status: revoked ? 'revoked' : 'failed',
          http_status: statusCode,
          error: sanitizePushError(pushError),
        }).eq('id', delivery.id),
        serviceClient.from('push_subscriptions').update({
          failure_count: subscription.failure_count + 1,
          revoked_at: revoked ? now : subscription.revoked_at,
        }).eq('id', subscription.id),
      ])
    }
  }

  const finalStatus = failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial'
  await serviceClient.from('notification_events').update({
    status: finalStatus,
    completed_at: new Date().toISOString(),
  }).eq('id', event.id)

  return NextResponse.json({ ok: true, event_id: event.id, sent, failed, status: finalStatus })
}
