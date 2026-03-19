import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User, Shift, Holiday, MonthStatus, EquityScore } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
  })
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  /* ---- Auth ---- */
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single<User>()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') redirect('/user')

  /* ---- Current month range ---- */
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  /* ---- Parallel data fetching ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any

  const [shiftsRes, usersRes, holidaysRes, monthStatusRes, equityRes] = await Promise.all([
    supabase.from('shifts').select('*').gte('date', from).lte('date', to),
    supabase.from('users').select('*').eq('ruolo', 'user').eq('attivo', true),
    supabase.from('holidays').select('*').gte('date', from).lte('date', to).eq('mandatory', true),
    supabase.from('month_status').select('*').eq('month', month + 1).eq('year', year).single<MonthStatus>(),
    supabaseAny.rpc('get_equity_scores', { p_month: 0, p_year: year }),
  ])

  const shifts = (shiftsRes.data ?? []) as Shift[]
  const activeUsers = (usersRes.data ?? []) as User[]
  const mandatoryHolidays = (holidaysRes.data ?? []) as Holiday[]
  const monthStatus = monthStatusRes.data as MonthStatus | null
  const equityScores = (equityRes.data ?? []) as EquityScore[]

  const isLocked = monthStatus?.status === 'locked'

  /* ---- Compute stats ---- */
  const userMap = new Map<string, string>(activeUsers.map((u) => [u.id, u.nome]))

  // Ranking annuale basato su equity scores (turni_totali dell'anno)
  const ranking = [...equityScores]
    .sort((a, b) => b.turni_totali - a.turni_totali)

  // Who covered mandatory holidays
  const holidayCoverage: { holiday: Holiday; workers: string[] }[] = mandatoryHolidays.map((h) => {
    const workers = shifts
      .filter((s) => s.date === h.date)
      .map((s) => userMap.get(s.user_id) ?? '—')
    return { holiday: h, workers }
  })

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} />

      {/* Main content offset for sidebar on desktop; pb-16 reserves space for mobile bottom nav */}
      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">

          {/* Welcome header */}
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard Admin</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Panoramica di {MONTH_NAMES[month]} {year}
            </p>
          </div>

          {/* Summary cards */}
          <section aria-labelledby="cards-heading">
            <h2 id="cards-heading" className="sr-only">Riepilogo mese</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Total shifts */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </span>
                  <p className="text-sm text-gray-500">Turni assegnati</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{shifts.length}</p>
                <p className="text-xs text-gray-400 mt-1">{MONTH_NAMES[month]} {year}</p>
              </div>

              {/* Active users */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </span>
                  <p className="text-sm text-gray-500">Dipendenti attivi</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{activeUsers.length}</p>
                <p className="text-xs text-gray-400 mt-1">disponibili questo mese</p>
              </div>

              {/* Month status */}
              <div className={`rounded-2xl shadow-sm border p-5 ${isLocked ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isLocked ? 'bg-gray-100' : 'bg-amber-50'}`} aria-hidden="true">
                    <svg className={`w-5 h-5 ${isLocked ? 'text-gray-500' : 'text-amber-600'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      {isLocked ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      )}
                    </svg>
                  </span>
                  <p className="text-sm text-gray-500">Stato mese</p>
                </div>
                <p className={`text-lg font-bold ${isLocked ? 'text-gray-600' : 'text-amber-600'}`}>
                  {isLocked ? 'Confermato' : monthStatus?.status === 'approved' ? 'Approvato' : 'Aperto'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {isLocked ? 'Non modificabile' : 'Modifiche permesse'}
                </p>
              </div>
            </div>
          </section>

          {/* Bottom row: ranking + holidays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Mini ranking */}
            <section
              aria-labelledby="ranking-heading"
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <h2 id="ranking-heading" className="text-base font-semibold text-gray-900 mb-4">
                Classifica turni — {year}
              </h2>

              {ranking.length === 0 ? (
                <p className="text-sm text-gray-400">Nessun dipendente attivo.</p>
              ) : (
                <ol className="space-y-2.5" aria-label="Classifica turni anno corrente">
                  {ranking.map((u, idx) => {
                    const maxCount = Number(ranking[0].turni_totali) || 1
                    const barWidth = Math.round((Number(u.turni_totali) / maxCount) * 100)
                    const isTop = idx === 0 && Number(u.turni_totali) > 0
                    const isBottom = idx === ranking.length - 1 && ranking.length > 1

                    return (
                      <li key={u.user_id} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 font-medium w-5 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-medium truncate ${isTop ? 'text-blue-700' : isBottom ? 'text-orange-600' : 'text-gray-700'}`}>
                              {u.nome}
                            </span>
                            <span className="text-xs text-gray-500 ml-2 shrink-0">{u.turni_totali} turni</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden" aria-hidden="true">
                            <div
                              className={`h-full rounded-full ${isTop ? 'bg-blue-500' : isBottom ? 'bg-orange-400' : 'bg-gray-300'}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}

              {/* Equity score mini note */}
              {equityScores.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-xs text-gray-400">
                    Priorità prossimo turno:{' '}
                    <strong className="text-green-700">
                      {[...equityScores].sort((a, b) => a.score - b.score)[0]?.nome ?? '—'}
                    </strong>
                  </p>
                </div>
              )}
            </section>

            {/* Mandatory holidays coverage */}
            <section
              aria-labelledby="holidays-heading"
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <h2 id="holidays-heading" className="text-base font-semibold text-gray-900 mb-4">
                Festività comandate — {MONTH_NAMES[month]}
              </h2>

              {holidayCoverage.length === 0 ? (
                <p className="text-sm text-gray-400">Nessuna festività comandata questo mese.</p>
              ) : (
                <ul className="space-y-3" aria-label="Copertura festività comandate">
                  {holidayCoverage.map(({ holiday, workers }) => (
                    <li key={holiday.id} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${workers.length > 0 ? 'bg-green-400' : 'bg-red-400'}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700">
                          {holiday.name}
                          <span className="ml-2 text-xs text-gray-400 font-normal">{formatDate(holiday.date)}</span>
                        </p>
                        {workers.length > 0 ? (
                          <p className="text-xs text-green-600">{workers.join(', ')}</p>
                        ) : (
                          <p className="text-xs text-red-500">Nessuno assegnato</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

        </main>
      </div>
    </div>
  )
}
