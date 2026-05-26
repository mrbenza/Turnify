import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock } from '../helpers/supabase'

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

import { POST } from '@/app/api/auth/track-login/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

describe('POST /api/auth/track-login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nega accesso se non autenticato', async () => {
    const client = makeSupabaseMock({ user: null, tables: {} })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue({} as never)

    const res = await POST()

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/non autenticato/i)
  })

  it('aggiorna last_login_at per l utente autenticato', async () => {
    const client = makeSupabaseMock({
      user: { id: 'user-1' },
      tables: {},
    })
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        users: [{ data: [], error: null }],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST()

    expect(res.status).toBe(200)
    expect(serviceClient.from).toHaveBeenCalledWith('users')
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.last_login_at).toBe('string')
  })
})
