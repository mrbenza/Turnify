import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, ok } from '../helpers/supabase'

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

import { GET } from '@/app/api/debug/auth/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_ID = 'admin-1'
const MANAGER_ID = 'manager-1'

describe('GET /api/debug/auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nega accesso al manager', async () => {
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users: [ok({ ruolo: 'manager', area_id: 'area-a' })],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue({} as never)

    const res = await GET(new Request('http://localhost/api/debug/auth'))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/non autorizzato/i)
  })

  it('consente accesso all admin', async () => {
    const client = {
      ...makeSupabaseMock({
        user: { id: ADMIN_ID },
        tables: {
          users: [ok({ ruolo: 'admin', area_id: null })],
        },
      }),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    const serviceClient = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({ data: { users: [], total: 0, nextPage: null, lastPage: 1 }, error: null }),
          getUserById: vi.fn().mockResolvedValue({ data: { user: { id: ADMIN_ID, email: 'admin@example.com', last_sign_in_at: null } }, error: null }),
        },
      },
    }

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await GET(new Request('http://localhost/api/debug/auth'))

    expect(res.status).toBe(200)
  })
})
