/**
 * Test: DELETE /api/shifts/[id]
 *
 * Casi coperti:
 * - turno su mese locked → 409
 * - turno su mese confirmed → 409
 * - manager elimina turno di altra area → 200 silenzioso (nessuna info disclosure)
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
}))

import { DELETE } from '@/app/api/shifts/[id]/route'
import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Costanti
// ──────────────────────────────────────────────

const MANAGER_ID = 'manager-1'
const AREA_A = 'area-a'
const AREA_B = 'area-b'
const SHIFT_ID = 'shift-1'

const mockParams = { params: Promise.resolve({ id: SHIFT_ID }) }

// ──────────────────────────────────────────────
// Test
// ──────────────────────────────────────────────

describe('DELETE /api/shifts/[id] — immutabilità e isolamento area', () => {
  beforeEach(() => vi.clearAllMocks())

  it('turno su mese locked → 409', async () => {
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users:        [ok({ ruolo: 'manager', area_id: AREA_A })],
        shifts:       [ok({ date: '2026-03-07', area_id: AREA_A })],  // shift trovato
        month_status: [ok({ status: 'locked' })],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await DELETE({} as Request, mockParams)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/confermato/i)
  })

  it('turno su mese confirmed → 409', async () => {
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users:        [ok({ ruolo: 'manager', area_id: AREA_A })],
        shifts:       [ok({ date: '2026-03-07', area_id: AREA_A })],
        month_status: [ok({ status: 'confirmed' })],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await DELETE({} as Request, mockParams)

    expect(res.status).toBe(409)
  })

  it('manager elimina turno di altra area → 200 silenzioso (nessuna info disclosure)', async () => {
    // Il shift non viene trovato perché la query è filtrata per area_id del manager.
    // La delete prosegue silenziosamente senza rivelare l'esistenza del turno.
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users:  [ok({ ruolo: 'manager', area_id: AREA_A })],
        shifts: [
          { data: null, error: null },  // maybeSingle: shift non trovato (altra area)
          { data: null, error: null },  // delete: nessuna riga eliminata, nessun errore
        ],
      },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await DELETE({} as Request, mockParams)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeUndefined()
    // Nessuna voce 403 che rivelarebbe l'esistenza del turno nell'altra area
    expect(body).not.toHaveProperty('area')
  })
})
