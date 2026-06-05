import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { DELETE, POST } from '@/app/api/push/subscriptions/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function authClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  }
}

function chain(result = { error: null }) {
  const value = {
    upsert: vi.fn(() => value),
    update: vi.fn(() => value),
    eq: vi.fn(() => value),
    then: (resolve: (result: { error: unknown }) => unknown) => Promise.resolve(result).then(resolve),
  }

  return value
}

describe('/api/push/subscriptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nega la registrazione se non autenticato', async () => {
    vi.mocked(createClient).mockResolvedValue(authClient(null) as never)

    const res = await POST(new Request('http://localhost/api/push/subscriptions', {
      method: 'POST',
      body: '{}',
    }))

    expect(res.status).toBe(401)
  })

  it('rifiuta subscription non valide', async () => {
    vi.mocked(createClient).mockResolvedValue(authClient({ id: 'user-1' }) as never)

    const res = await POST(new Request('http://localhost/api/push/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'http://example.com/push',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      }),
    }))

    expect(res.status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('salva o aggiorna la subscription valida per endpoint', async () => {
    const table = chain()
    const serviceClient = { from: vi.fn(() => table) }
    vi.mocked(createClient).mockResolvedValue(authClient({ id: 'user-1' }) as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST(new Request('http://localhost/api/push/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Chrome Android',
      },
      body: JSON.stringify({
        endpoint: 'https://fcm.googleapis.com/push/example',
        expirationTime: Date.UTC(2026, 0, 1),
        keys: { p256dh: 'p256dh', auth: 'auth' },
      }),
    }))

    expect(res.status).toBe(200)
    expect(serviceClient.from).toHaveBeenCalledWith('push_subscriptions')
    expect(table.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      endpoint: 'https://fcm.googleapis.com/push/example',
      p256dh: 'p256dh',
      auth: 'auth',
      expiration_time: '2026-01-01T00:00:00.000Z',
      user_agent: 'Chrome Android',
      revoked_at: null,
      failure_count: 0,
    }), { onConflict: 'endpoint' })
  })

  it('revoca la subscription dell utente corrente', async () => {
    const table = chain()
    const serviceClient = { from: vi.fn(() => table) }
    vi.mocked(createClient).mockResolvedValue(authClient({ id: 'user-1' }) as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await DELETE(new Request('http://localhost/api/push/subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/push/example' }),
    }))

    expect(res.status).toBe(200)
    expect(table.update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }))
    expect(table.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(table.eq).toHaveBeenCalledWith('endpoint', 'https://fcm.googleapis.com/push/example')
  })
})
