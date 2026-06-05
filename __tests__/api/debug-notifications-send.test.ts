import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PushSubscription } from '@/lib/supabase/types'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

vi.mock('@/lib/debug-auth', () => ({
  requireDebugAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/push/server', () => ({
  sendWebPush: vi.fn(),
  getPushStatusCode: (error: unknown) => {
    if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
    const statusCode = error.statusCode
    return typeof statusCode === 'number' ? statusCode : null
  },
  sanitizePushError: (error: unknown) => error instanceof Error ? error.message.slice(0, 500) : 'Errore Web Push sconosciuto',
}))

import { PATCH, POST } from '@/app/api/debug/notifications/route'
import { requireDebugAdmin } from '@/lib/debug-auth'
import { sendWebPush } from '@/lib/push/server'
import { createServiceClient } from '@/lib/supabase/server'

const subscriptions: PushSubscription[] = [
  {
    id: 'sub-ok',
    user_id: 'user-1',
    endpoint: 'https://fcm.googleapis.com/push/ok',
    p256dh: 'p256dh-ok',
    auth: 'auth-ok',
    expiration_time: null,
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
  },
  {
    id: 'sub-gone',
    user_id: 'user-2',
    endpoint: 'https://fcm.googleapis.com/push/gone',
    p256dh: 'p256dh-gone',
    auth: 'auth-gone',
    expiration_time: null,
    user_agent: 'Chrome Android',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    last_seen_at: '2026-01-01T00:00:00.000Z',
    last_success_at: null,
    failure_count: 2,
    revoked_at: null,
    client_mode: 'standalone',
    revoked_reason: null,
    revoked_by: null,
  },
]

function makeChain(result: { data?: unknown; error?: unknown }, updates: Array<{ table: string; value: unknown }>, table: string) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn((value: unknown) => {
      updates.push({ table, value })
      return chain
    }),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null }),
    single: vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null }),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve),
  }

  return chain
}

function makeServiceClient() {
  const updates: Array<{ table: string; value: unknown }> = []
  let deliveryNumber = 0

  const serviceClient = {
    updates,
    from: vi.fn((table: string) => {
      if (table === 'push_subscriptions') {
        return makeChain({ data: subscriptions, error: null }, updates, table)
      }
      if (table === 'notification_events') {
        return makeChain({ data: { id: 'event-1' }, error: null }, updates, table)
      }
      if (table === 'notification_deliveries') {
        deliveryNumber += 1
        return makeChain({ data: { id: `delivery-${deliveryNumber}` }, error: null }, updates, table)
      }
      return makeChain({ data: null, error: null }, updates, table)
    }),
  }

  return serviceClient
}

describe('POST /api/debug/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireDebugAdmin).mockResolvedValue({
      ok: true,
      user: { id: 'admin-1' },
      profile: { nome: 'Admin', ruolo: 'admin', attivo: true },
    } as never)
  })

  it('registra delivery sent e revoked e chiude evento come partial', async () => {
    const serviceClient = makeServiceClient()
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)
    vi.mocked(sendWebPush)
      .mockResolvedValueOnce({ statusCode: 201 } as never)
      .mockRejectedValueOnce(Object.assign(new Error('Endpoint scaduto'), { statusCode: 410 }))

    const res = await POST(new Request('http://localhost/api/debug/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionIds: ['sub-ok', 'sub-gone'],
        title: 'Test',
        message: 'Messaggio',
        url: '/user',
      }),
    }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      event_id: 'event-1',
      sent: 1,
      failed: 1,
      status: 'partial',
    })

    expect(sendWebPush).toHaveBeenCalledTimes(2)
    expect(serviceClient.updates).toEqual(expect.arrayContaining([
      { table: 'notification_deliveries', value: expect.objectContaining({ status: 'sent', http_status: 201 }) },
      { table: 'push_subscriptions', value: expect.objectContaining({ failure_count: 0, last_success_at: expect.any(String) }) },
      { table: 'notification_deliveries', value: expect.objectContaining({ status: 'revoked', http_status: 410, error: 'Endpoint scaduto' }) },
      { table: 'push_subscriptions', value: expect.objectContaining({ failure_count: 3, revoked_at: expect.any(String), revoked_reason: 'push_service_gone' }) },
      { table: 'notification_events', value: expect.objectContaining({ status: 'partial', completed_at: expect.any(String) }) },
    ]))
  })

  it('rifiuta destinazioni esterne prima di creare eventi', async () => {
    const serviceClient = makeServiceClient()
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST(new Request('http://localhost/api/debug/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionIds: ['sub-ok'],
        title: 'Test',
        message: 'Messaggio',
        url: 'https://example.com',
      }),
    }))

    expect(res.status).toBe(400)
    expect(sendWebPush).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('revoca manualmente una subscription dalla diagnostica admin', async () => {
    const serviceClient = makeServiceClient()
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await PATCH(new Request('http://localhost/api/debug/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', subscriptionId: 'sub-ok' }),
    }))

    expect(res.status).toBe(200)
    expect(serviceClient.updates).toEqual(expect.arrayContaining([
      { table: 'push_subscriptions', value: expect.objectContaining({
        revoked_at: expect.any(String),
        revoked_reason: 'manual_admin',
        revoked_by: 'admin-1',
      }) },
    ]))
  })
})
