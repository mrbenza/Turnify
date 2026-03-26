import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sortByNome } from '@/lib/utils/sort'
import type { EquityScore } from '@/lib/supabase/types'

export interface AreaEquitySummary {
  areaId: string
  areaNome: string
  numDipendenti: number
  avgScore: number
  minScore: number
  maxScore: number
  delta: number
  scores: EquityScore[]
}

/**
 * GET /api/equity-overview?month=<1-12>&year=<yyyy>
 * month=0 → tutti i tempi
 * Richiede ruolo admin.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('ruolo').eq('id', user.id).single()
  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = Number(searchParams.get('month') ?? 0)
  const year = Number(searchParams.get('year') ?? new Date().getFullYear())

  // service_role: RPC get_equity_scores cross-area + SELECT areas per tutte le aree (admin panoramica)
  const serviceClient = createServiceClient()

  // Carica tutte le aree (esclusa Default)
  const { data: areasRaw, error: areasError } = await serviceClient
    .from('areas')
    .select('id, nome')
    .neq('nome', 'Default')

  if (areasError || !areasRaw) {
    return NextResponse.json({ error: 'Errore caricamento aree' }, { status: 500 })
  }

  const areas = sortByNome(areasRaw)

  // Carica equity scores per tutte le aree in parallelo
  const results = await Promise.all(
    areas.map(async (area) => {
      const { data: scores } = await serviceClient.rpc('get_equity_scores', {
        p_month: month,
        p_year: year,
        p_area_id: area.id,
      })

      const list: EquityScore[] = scores ?? []
      const numDipendenti = list.length

      if (numDipendenti === 0) {
        return {
          areaId: area.id,
          areaNome: area.nome,
          numDipendenti: 0,
          avgScore: 0,
          minScore: 0,
          maxScore: 0,
          delta: 0,
          scores: [],
        } satisfies AreaEquitySummary
      }

      const scoreValues = list.map((s) => s.score)
      const minScore = Math.min(...scoreValues)
      const maxScore = Math.max(...scoreValues)
      const avgScore = Math.round((scoreValues.reduce((a, b) => a + b, 0) / numDipendenti) * 10) / 10

      return {
        areaId: area.id,
        areaNome: area.nome,
        numDipendenti,
        avgScore,
        minScore,
        maxScore,
        delta: maxScore - minScore,
        scores: list,
      } satisfies AreaEquitySummary
    })
  )

  return NextResponse.json(results)
}
