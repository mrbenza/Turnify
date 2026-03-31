/**
 * Test: POST /api/availability
 *
 * Casi coperti:
 * - disponibilità su mese locked → 403
 * - disponibilità su mese confirmed → 403
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

import { POST } from '@/app/api/availability/route'
import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Costanti
// ──────────────────────────────────────────────

const USER_ID = 'user-1'
const AREA_ID = 'area-test'

// Sabato futuro (2026 è ragionevole, currentYear check lo accetta)
const FUTURE_DATE = '2026-03-07'

function mockRequest(body: object) {
  return { json: async () => body } as unknown as Request
}

function buildClient(monthStatus: { status: string } | null) {
  return makeSupabaseMock({
    user: { id: USER_ID },
    tables: {
      // users[0] → profilo con area_id
      users:        [ok({ area_id: AREA_ID })],
      month_status: [monthStatus ? ok(monthStatus) : { data: null, error: null }],
    },
  })
}

// ──────────────────────────────────────────────
// Test
// ──────────────────────────────────────────────

describe('POST /api/availability — immutabilità mese', () => {
  beforeEach(() => vi.clearAllMocks())

  it('disponibilità su mese locked → 403', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildClient({ status: 'locked' }) as never
    )

    const res = await POST(mockRequest({ date: FUTURE_DATE, available: true }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/confermato/i)
  })

  it('disponibilità su mese confirmed → 403', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildClient({ status: 'confirmed' }) as never
    )

    const res = await POST(mockRequest({ date: FUTURE_DATE, available: true }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/confermato/i)
  })
})
