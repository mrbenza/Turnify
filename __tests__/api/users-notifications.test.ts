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

import { PATCH } from '@/app/api/users/[id]/notifications/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function authClient(user: { id: string } | null, profile: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data: profile, error: null }),
  }

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => chain),
  }
}

function chain(result: { data: unknown; error: unknown }, updates: unknown[] = []) {
  const value = {
    select: vi.fn(() => value),
    update: vi.fn((payload: unknown) => {
      updates.push(payload)
      return value
    }),
    eq: vi.fn(() => value),
    is: vi.fn(() => value),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (result: { data: unknown; error: unknown }) => unknown) => Promise.resolve(result).then(resolve),
  }

  return value
}

describe('PATCH /api/users/[id]/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revoca tutte le subscription attive di un utente', async () => {
    const updates: unknown[] = []
    const targetChain = chain({ data: { ruolo: 'dipendente', area_id: 'area-1' }, error: null })
    const pushChain = chain({ data: [{ id: 'sub-1' }, { id: 'sub-2' }], error: null }, updates)
    const serviceClient = {
      from: vi.fn((table: string) => table === 'users' ? targetChain : pushChain),
    }

    vi.mocked(createClient).mockResolvedValue(authClient(
      { id: 'admin-1' },
      { ruolo: 'admin', area_id: null },
    ) as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await PATCH(new Request('http://localhost/api/users/user-1/notifications', { method: 'PATCH' }), {
      params: Promise.resolve({ id: 'user-1' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, revoked: 2 })
    expect(updates).toEqual([expect.objectContaining({
      revoked_at: expect.any(String),
      revoked_reason: 'manual_admin',
      revoked_by: 'admin-1',
    })])
    expect(pushChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(pushChain.is).toHaveBeenCalledWith('revoked_at', null)
  })

  it('blocca sempre il manager', async () => {
    const targetChain = chain({ data: { ruolo: 'dipendente', area_id: 'area-2' }, error: null })
    const serviceClient = {
      from: vi.fn(() => targetChain),
    }

    vi.mocked(createClient).mockResolvedValue(authClient(
      { id: 'manager-1' },
      { ruolo: 'manager', area_id: 'area-1' },
    ) as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await PATCH(new Request('http://localhost/api/users/user-1/notifications', { method: 'PATCH' }), {
      params: Promise.resolve({ id: 'user-1' }),
    })

    expect(res.status).toBe(403)
  })
})
