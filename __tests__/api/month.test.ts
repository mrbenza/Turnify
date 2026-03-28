/**
 * Test: POST /api/month
 *
 * Casi coperti:
 * - lock con copertura incompleta → 422
 * - lock con copertura completa → 200
 * - unlock mese confirmed come manager → 403
 * - unlock mese confirmed come admin → 200
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

import { POST } from '@/app/api/month/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Costanti
// ──────────────────────────────────────────────

const MANAGER_ID = 'manager-1'
const ADMIN_ID   = 'admin-1'
const AREA_ID    = 'area-test'

// Marzo 2026: inizia di domenica, 9 giorni di weekend
const MARCH_2026_WEEKENDS = [
  '2026-03-01', '2026-03-07', '2026-03-08',
  '2026-03-14', '2026-03-15', '2026-03-21',
  '2026-03-22', '2026-03-28', '2026-03-29',
]

function mockRequest(body: object) {
  return { json: async () => body } as unknown as Request
}

// ──────────────────────────────────────────────
// Test
// ──────────────────────────────────────────────

describe('POST /api/month — lock / unlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lock: copertura incompleta → 422 con messaggio esplicito', async () => {
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users: [ok({ ruolo: 'manager', area_id: AREA_ID })],
      },
    })
    // Solo 1 giorno coperto su 9 → 8 scoperti
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        areas:        [ok({ workers_per_day: 1 })],
        holidays:     [{ data: [], error: null }],
        shifts:       [{ data: [{ date: '2026-03-07' }], error: null }],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST(mockRequest({ month: 3, year: 2026, action: 'lock', area_id: AREA_ID }))

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/copertura/i)
    // 8 giorni scoperti (9 weekend - 1 coperto)
    expect(body.error).toMatch(/\b8\b/)
  })

  it('lock: tutti i giorni coperti → 200', async () => {
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users: [ok({ ruolo: 'manager', area_id: AREA_ID })],
      },
    })
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        areas:        [ok({ workers_per_day: 1 })],
        holidays:     [{ data: [], error: null }],
        // Tutti e 9 i weekend coperti
        shifts:       [{ data: MARCH_2026_WEEKENDS.map(d => ({ date: d })), error: null }],
        month_status: [
          ok(null),                      // .single() → non esiste → insert path
          { data: null, error: null },   // insert → success
        ],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST(mockRequest({ month: 3, year: 2026, action: 'lock', area_id: AREA_ID }))

    expect(res.status).toBe(200)
  })

  it('unlock: manager non può sbloccare mese confirmed → 403', async () => {
    const client = makeSupabaseMock({
      user: { id: MANAGER_ID },
      tables: {
        users: [ok({ ruolo: 'manager', area_id: AREA_ID })],
      },
    })
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        // Coverage check saltato (action=unlock); solo lettura month_status
        month_status: [ok({ id: 'ms-1', status: 'confirmed' })],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST(mockRequest({ month: 3, year: 2026, action: 'unlock', area_id: AREA_ID }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/amministratore/i)
  })

  it('unlock: admin può sbloccare mese confirmed → 200', async () => {
    const client = makeSupabaseMock({
      user: { id: ADMIN_ID },
      tables: {
        users: [ok({ ruolo: 'admin', area_id: null })],
      },
    })
    const serviceClient = makeSupabaseMock({
      user: null,
      tables: {
        month_status: [
          ok({ id: 'ms-1', status: 'confirmed' }),  // .single() → esiste
          { data: null, error: null },               // .update() → success
        ],
      },
    })

    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(createServiceClient).mockReturnValue(serviceClient as never)

    const res = await POST(mockRequest({ month: 3, year: 2026, action: 'unlock', area_id: AREA_ID }))

    expect(res.status).toBe(200)
  })
})
