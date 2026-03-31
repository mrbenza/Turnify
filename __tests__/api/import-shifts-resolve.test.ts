/**
 * Test: POST /api/import-shifts/resolve
 *
 * Casi coperti:
 * - resolve con mesi locked → 422 con lista mesi bloccati
 * - resolve con mesi aperti → 200 con conteggio inseriti
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

import { POST } from '@/app/api/import-shifts/resolve/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Costanti
// ──────────────────────────────────────────────

const ADMIN_ID = 'admin-1'
const AREA_ID  = 'area-test'

const BODY_BASE = {
  user_id:   'user-1',
  user_nome: 'Mario Rossi',
  area_id:   AREA_ID,
  shifts: [
    { date: '2026-03-07', shift_type: 'weekend', reperibile_order: 1 },
    { date: '2026-03-08', shift_type: 'weekend', reperibile_order: 1 },
  ],
}

function mockRequest(body: object) {
  return { json: async () => body } as unknown as Request
}

// ──────────────────────────────────────────────
// Test
// ──────────────────────────────────────────────

describe('POST /api/import-shifts/resolve — immutabilità', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mesi coinvolti locked → 422 con lista mesi bloccati', async () => {
    const client = makeSupabaseMock({
      user: { id: ADMIN_ID },
      tables: {
        // La route richiede area_id anche per l'admin
        users: [ok({ ruolo: 'admin', area_id: AREA_ID })],
      },
    })
    // month_status: marzo 2026 è locked
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        month_status: [{ data: [{ month: 3, year: 2026, status: 'locked' }], error: null }],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST(mockRequest(BODY_BASE))

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/bloccati|confermati/i)
    expect(body.error).toMatch(/03\/2026/)
  })

  it('mesi aperti → 200 con conteggio turni inseriti', async () => {
    const client = makeSupabaseMock({
      user: { id: ADMIN_ID },
      tables: {
        users: [ok({ ruolo: 'admin', area_id: AREA_ID })],
      },
    })
    // Nessun mese bloccato → procede con upsert
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        month_status: [{ data: [], error: null }],
        shifts: [{ data: [{ id: 's1' }, { id: 's2' }], error: null }],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST(mockRequest(BODY_BASE))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBe(2)
  })
})
