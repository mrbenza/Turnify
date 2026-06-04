import webPush from 'web-push'
import type { PushSubscription } from '@/lib/supabase/types'

export type PushPayload = {
  title: string
  body: string
  url: string
}

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  const subject = process.env.WEB_PUSH_SUBJECT

  if (!publicKey || !privateKey || !subject) {
    throw new Error('Configurazione Web Push incompleta')
  }

  webPush.setVapidDetails(subject, publicKey, privateKey)
}

export function sendWebPush(subscription: PushSubscription, payload: PushPayload) {
  configureWebPush()

  return webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expiration_time
        ? new Date(subscription.expiration_time).getTime()
        : null,
      keys: {
        auth: subscription.auth,
        p256dh: subscription.p256dh,
      },
    },
    JSON.stringify(payload),
  )
}

export function sanitizePushError(error: unknown) {
  if (!(error instanceof Error)) return 'Errore Web Push sconosciuto'
  return error.message.slice(0, 500)
}

export function getPushStatusCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
  const statusCode = error.statusCode
  return typeof statusCode === 'number' ? statusCode : null
}
