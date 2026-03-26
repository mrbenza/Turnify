import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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
    .select('ruolo, nome, area_id')
    .eq('id', authUser.id)
    .single<{ ruolo: string; nome: string; area_id: string }>()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') redirect('/user')
  if (profile?.ruolo === 'admin') redirect('/admin')

  const areaId = profile.area_id ?? ''

  const serviceClient = createServiceClient()

  /* ---- Nome area per badge navbar ---- */
  const { data: areaData } = await serviceClient
    .from('areas').select('nome').eq('id', areaId).maybeSingle()
  const areaNome = areaData?.nome ?? undefined

  /* ---- Initial equity scores for current month ---- */
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  const { data: initialScores } = await supabase.rpc('get_equity_scores', {
    p_month: month + 1,
    p_year: year,
    p_area_id: areaId,
  })

  const scores = (initialScores ?? []) as EquityScore[]

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin
        nomeAdmin={profile?.nome}
        ruolo={profile?.ruolo as 'admin' | 'manager'}
        areaNome={areaNome}
      />

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
            <div className="flex items-center gap-2 mb-6">
              <h2 id="grafico-equita-heading" className="text-base font-semibold text-gray-900">
                Score equità
              </h2>
              <div className="relative group">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center cursor-default select-none hover:bg-gray-200">
                  ?
                </span>
                <div className="absolute left-0 top-6 z-20 hidden group-hover:block w-60 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Come si calcola lo score</p>
                  <table className="w-full text-xs text-gray-600">
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-1">Weekend (Sab o Dom)</td>
                        <td className="py-1 text-right font-mono font-medium text-gray-900">×1</td>
                      </tr>
                      <tr>
                        <td className="py-1">Festivo attivo</td>
                        <td className="py-1 text-right font-mono font-medium text-gray-900">×3</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400 mt-2">Score basso = priorità alta</p>
                </div>
              </div>
            </div>
            <GraficoEquita
              initialScores={scores}
              initialMonth={month}
              initialYear={year}
              areaId={areaId}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
