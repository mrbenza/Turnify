import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { EquityScore } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import GraficoEquita from '@/components/admin/statistiche/GraficoEquita'

export default async function StatistichePage() {
  const supabase = await createClient()

  /* ---- Auth ---- */
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, nome')
    .eq('id', authUser.id)
    .single<{ ruolo: string; nome: string }>()

  if (profile?.ruolo !== 'admin') redirect('/user')

  /* ---- Initial equity scores for current month ---- */
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const { data: initialScores } = await supabaseAny.rpc('get_equity_scores', {
    p_month: month + 1,
    p_year: year,
  })

  const scores = (initialScores ?? []) as EquityScore[]

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Statistiche equità</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Distribuzione turni e score equità per dipendente
            </p>
          </div>

          <section
            aria-labelledby="grafico-equita-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="grafico-equita-heading" className="text-base font-semibold text-gray-900 mb-6">
              Score equità
            </h2>
            <GraficoEquita
              initialScores={scores}
              initialMonth={month}
              initialYear={year}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
