import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import RiepilogoEquitaAree from '@/components/admin/equita/RiepilogoEquitaAree'
import type { AreaEquitySummary } from '@/app/api/equity-overview/route'
import type { EquityScore } from '@/lib/supabase/types'

export default async function EquitaPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, nome')
    .eq('id', authUser.id)
    .single<{ ruolo: string; nome: string }>()

  if (!profile || profile.ruolo !== 'admin') redirect('/admin')

  const now = new Date()
  const currentMonth = now.getMonth() // 0-indexed
  const currentYear = now.getFullYear()

  // service_role: RPC get_equity_scores cross-area + SELECT areas per panoramica admin
  const serviceClient = createServiceClient()

  // Carica tutte le aree (esclusa Default)
  const { data: areas } = await serviceClient
    .from('areas')
    .select('id, nome')
    .neq('nome', 'Default')
    .order('nome', { ascending: true })

  const areaList = areas ?? []

  // Carica equity scores per tutte le aree in parallelo (mese corrente)
  const summaries: AreaEquitySummary[] = await Promise.all(
    areaList.map(async (area) => {
      const { data: scores } = await serviceClient.rpc('get_equity_scores', {
        p_month: currentMonth + 1,
        p_year: currentYear,
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
        }
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
      }
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile.nome} ruolo="admin" />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Equità turni</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Panoramica della distribuzione turni per area — clicca un&apos;area per vedere il ranking completo
            </p>
          </div>

          <RiepilogoEquitaAree
            initialData={summaries}
            initialMonth={currentMonth}
            initialYear={currentYear}
          />
        </main>
      </div>
    </div>
  )
}
