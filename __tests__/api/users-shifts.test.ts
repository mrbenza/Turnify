/**
 * Test: GET /api/users/[id]/shifts
 *
 * Casi coperti:
 * - manager legge storico di utente di altra area → 403
 * - admin legge storico di qualsiasi utente → 200
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
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

import { GET } from '@/app/api/users/[id]/shifts/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Costanti
// ──────────────────────────────────────────────

const ADMIN_ID   = 'admin-1'
const MANAGER_ID = 'manager-1'
const TARGET_ID  = 'target-user-1'
const AREA_A = 'area-a'
const AREA_B = 'area-b'

function mockParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ──────────────────────────────────────────────
// Test
// ──────────────────────────────────────────────

describe('GET /api/users/[id]/shifts — isolamento area', () => {
  beforeEach(() => vi.clearAllMocks())

  it('manager legge storico utente di altra area → 403', async () => {
    // supabase client:
    //   users[0] → profile del manager
    //   users[1] → callerProfile (area_id del manager per il confronto)
    // serviceClient:
    //   users[0] → targetProfile con area_id diversa
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users: [
          ok({ ruolo: 'manager' }),    // profile
          ok({ area_id: AREA_A }),     // callerProfile
        ],
      },
    })
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        users: [ok({ area_id: AREA_B })],  // targetProfile — area diversa
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await GET({} as Request, mockParams(TARGET_ID))

    expect(res.status).toBe(403)
  })

  it('admin legge storico di qualsiasi utente → 200', async () => {
    // Admin salta il controllo area. Poi Promise.all:
    //   serviceClient.users[0] → target (nome, area_id)
    //   serviceClient.shifts[0] → lista turni (thenable, array)
    // Nessun festivo → holidays non viene chiamato
    const client = makeSupabaseMock({
      user: { id: ADMIN_ID },
      tables: {
        users: [ok({ ruolo: 'admin' })],
      },
    })
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        users:  [ok({ nome: 'Mario Rossi', area_id: AREA_B })],
        shifts: [{ data: [{ date: '2026-03-07', shift_type: 'weekend', area_id: AREA_B }], error: null }],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await GET({} as Request, mockParams(TARGET_ID))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nome).toBe('Mario Rossi')
    expect(body.shifts).toHaveLength(1)
    expect(body.byMonth).toHaveLength(1)
  })
})
