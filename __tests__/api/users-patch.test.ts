/**
 * Test: PATCH /api/users/[id]
 *
 * Casi coperti:
 * - manager tenta cambio ruolo → 403
 * - admin tenta di cambiare il proprio ruolo → 403
 * - admin non può essere disattivato → 403
 * - manager disattiva utente di altra area → 403
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

import { PATCH } from '@/app/api/users/[id]/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Costanti
// ──────────────────────────────────────────────

const ADMIN_ID   = 'admin-1'
const MANAGER_ID = 'manager-1'
const TARGET_ID  = 'target-user-1'
const AREA_A = 'area-a'
const AREA_B = 'area-b'

function mockRequest(body: object) {
  return { json: async () => body } as unknown as Request
}

function mockParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ──────────────────────────────────────────────
// Test
// ──────────────────────────────────────────────

describe('PATCH /api/users/[id] — privilege escalation e isolamento area', () => {
  beforeEach(() => vi.clearAllMocks())

  it('manager tenta cambio ruolo → 403', async () => {
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users: [ok({ ruolo: 'manager' })],  // profile del caller
      },
    })
    // serviceClient viene inizializzato ma non chiamato (return early a 403)
    const serviceClient = makeSupabaseMock({ user: null, tables: {} })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await PATCH(mockRequest({ ruolo: 'admin' }), mockParams(TARGET_ID))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/amministratore/i)
  })

  it('admin tenta di cambiare il proprio ruolo → 403', async () => {
    // L'id nel path è lo stesso dell'utente autenticato
    const client = makeSupabaseMock({
      user: { id: ADMIN_ID },
      tables: {
        users: [ok({ ruolo: 'admin' })],
      },
    })
    const serviceClient = makeSupabaseMock({ user: null, tables: {} })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await PATCH(mockRequest({ ruolo: 'dipendente' }), mockParams(ADMIN_ID))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/ruolo/i)
  })

  it('nessuno può disattivare un admin → 403', async () => {
    // Caller: admin; Target: anche admin → bloccato
    const client = makeSupabaseMock({
      user: { id: ADMIN_ID },
      tables: {
        users: [ok({ ruolo: 'admin' })],  // profile caller
      },
    })
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        // targetProfile: l'utente target è un admin
        users: [ok({ ruolo: 'admin', area_id: null })],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await PATCH(mockRequest({ attivo: false }), mockParams(TARGET_ID))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/amministratore/i)
  })

  it('manager disattiva utente di altra area → 403', async () => {
    // Profile caller (manager, area-A)
    // Target: dipendente in area-B
    // callerProfile letto per verifica area: area-A
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users: [
          ok({ ruolo: 'manager' }),              // profile del caller
          ok({ area_id: AREA_A }),               // callerProfile (area del manager)
        ],
      },
    })
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        users: [ok({ ruolo: 'dipendente', area_id: AREA_B })],  // targetProfile
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await PATCH(mockRequest({ attivo: false }), mockParams(TARGET_ID))

    expect(res.status).toBe(403)
  })
})
