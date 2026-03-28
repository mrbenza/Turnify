/**
 * Test: POST /api/shifts
 *
 * Casi coperti:
 * - immutabilità: turno su mese locked → 409
 * - immutabilità: turno su mese confirmed → 409
 * - isolamento area: manager assegna turno a dipendente di altra area → 403
 * - caso positivo: turno valido su mese aperto, stessa area → 201
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

import { POST } from '@/app/api/shifts/route'
import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Costanti
// ──────────────────────────────────────────────

const MANAGER_ID    = 'manager-1'
const TARGET_USER_A = 'user-area-a'
const TARGET_USER_B = 'user-area-b'
const AREA_A        = 'area-a'
const AREA_B        = 'area-b'

// Mercoledì 18 marzo 2026: giorno feriale, nessun festivo → shiftType = 'reperibilita'
// Salta il blocco conflict-check (solo weekend/festivo), semplifica le mock queue
const WEEKDAY_DATE = '2026-03-18'

function mockRequest(body: object) {
  return { json: async () => body } as unknown as Request
}

/**
 * Costruisce il client mock per il caso base (manager di AREA_A che assegna TARGET_USER_A).
 * Ordine query shifts route:
 *   users[0]        → profile del caller (manager, AREA_A)
 *   areas[0]        → config area (scheduling_mode, workers_per_day)
 *   holidays[0]     → nessun festivo sulla data
 *   shifts[0]       → 0 turni già assegnati per quel giorno (workers_per_day check)
 *   month_status[0] → stato mese (da sovrascrivere per i test immutabilità)
 *   users[1]        → profilo target (da sovrascrivere per i test isolamento)
 *   shifts[1]       → risultato insert (solo per il caso positivo)
 */
function buildClient({
  monthStatus,
  targetAreaId,
  includeInsert = false,
}: {
  monthStatus: { status: string } | null
  targetAreaId: string
  includeInsert?: boolean
}) {
  return makeSupabaseMock({
    user: { id: MANAGER_ID },
    tables: {
      users: [
        ok({ ruolo: 'manager', area_id: AREA_A }),
        ok({ nome: 'Mario Rossi', area_id: targetAreaId }),
      ],
      areas:    [ok({ scheduling_mode: 'single_day', workers_per_day: 1 })],
      holidays: [{ data: null, error: null }],
      shifts: [
        { data: [], error: null },                                          // workers_per_day check
        ...(includeInsert ? [ok({ id: 'new-shift', date: WEEKDAY_DATE })] : []),
      ],
      month_status: [monthStatus ? ok(monthStatus) : { data: null, error: null }],
    },
  })
}

// ──────────────────────────────────────────────
// Test
// ──────────────────────────────────────────────

describe('POST /api/shifts — immutabilità e isolamento area', () => {
  beforeEach(() => vi.clearAllMocks())

  it('immutabilità: turno su mese locked → 409', async () => {
    const client = buildClient({ monthStatus: { status: 'locked' }, targetAreaId: AREA_A })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(mockRequest({ date: WEEKDAY_DATE, user_id: TARGET_USER_A }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/confermato/i)
  })

  it('immutabilità: turno su mese confirmed → 409', async () => {
    const client = buildClient({ monthStatus: { status: 'confirmed' }, targetAreaId: AREA_A })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(mockRequest({ date: WEEKDAY_DATE, user_id: TARGET_USER_A }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/confermato/i)
  })

  it('isolamento area: manager assegna turno a dipendente di altra area → 403', async () => {
    // Mese aperto, ma il target appartiene a AREA_B
    const client = buildClient({ monthStatus: null, targetAreaId: AREA_B })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(mockRequest({ date: WEEKDAY_DATE, user_id: TARGET_USER_B }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/area/i)
  })

  it('caso positivo: turno su mese aperto, stessa area → 201', async () => {
    const client = buildClient({ monthStatus: null, targetAreaId: AREA_A, includeInsert: true })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await POST(mockRequest({ date: WEEKDAY_DATE, user_id: TARGET_USER_A }))

    expect(res.status).toBe(201)
  })
})
