import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PushSubscription } from '@/lib/supabase/types'

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}))

import webPush from 'web-push'
import { getPushStatusCode, sanitizePushError, sendWebPush } from '@/lib/push/server'

const subscription: PushSubscription = {
  id: 'sub-1',
  user_id: 'user-1',
  endpoint: 'https://fcm.googleapis.com/push/example',
  p256dh: 'p256dh',
  auth: 'auth',
  expiration_time: '2026-01-01T00:00:00.000Z',
  user_agent: 'Chrome Android',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  last_seen_at: '2026-01-01T00:00:00.000Z',
  last_success_at: null,
  failure_count: 0,
  revoked_at: null,
  client_mode: 'standalone',
  revoked_reason: null,
  revoked_by: null,
}

describe('Web Push server helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', 'public-key')
    vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', 'private-key')
    vi.stubEnv('WEB_PUSH_SUBJECT', 'mailto:admin@turnify.test')
  })

  it('firma e invia la notifica con VAPID', async () => {
    await sendWebPush(subscription, { title: 'Titolo', body: 'Testo', url: '/user' })

    expect(webPush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:admin@turnify.test',
      'public-key',
      'private-key',
    )
    expect(webPush.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: subscription.endpoint,
      expirationTime: Date.UTC(2026, 0, 1),
      keys: {
        auth: 'auth',
        p256dh: 'p256dh',
      },
    }), JSON.stringify({ title: 'Titolo', body: 'Testo', url: '/user' }))
  })

  it('fallisce se la configurazione VAPID e incompleta', async () => {
    vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', '')

    expect(() => sendWebPush(subscription, { title: 'Titolo', body: 'Testo', url: '/user' }))
      .toThrow('Configurazione Web Push incompleta')
    expect(webPush.sendNotification).not.toHaveBeenCalled()
  })

  it('estrae status HTTP e sanifica errori', () => {
    const error = Object.assign(new Error('x'.repeat(600)), { statusCode: 410 })

    expect(getPushStatusCode(error)).toBe(410)
    expect(sanitizePushError(error)).toHaveLength(500)
    expect(getPushStatusCode(new Error('senza status'))).toBeNull()
  })
})
