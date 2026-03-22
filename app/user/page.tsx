import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User, MonthStatus } from '@/lib/supabase/types'
import NavbarUtente from '@/components/user/NavbarUtente'
import CalendarioDisponibilita from '@/components/user/CalendarioDisponibilita'
import StoricoTurni from '@/components/user/StoricoTurni'

export default async function UserPage() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  // User profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single<User>()

  // Date range: current month + next month
  const now = new Date()
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0) // last day of next month

  const fromStr = startOfCurrentMonth.toISOString().slice(0, 10)
  const toStr = endOfNextMonth.toISOString().slice(0, 10)

  // Parallel fetches for performance
  const [availabilityRes, holidaysRes, shiftsRes, monthStatusRes] = await Promise.all([
    supabase
      .from('availability')
      .select('*')
      .eq('user_id', authUser.id)
      .gte('date', fromStr)
      .lte('date', toStr),

    supabase
      .from('holidays')
      .select('*')
      .gte('date', fromStr)
      .lte('date', toStr),

    supabase
      .from('shifts')
      .select('*')
      .eq('user_id', authUser.id)
      .gte('date', fromStr)
      .lte('date', toStr),

    supabase
      .from('month_status')
      .select('*')
      .eq('status', 'locked'),
  ])

  const availabilityList = availabilityRes.data ?? []
  const holidays = holidaysRes.data ?? []
  const shifts = shiftsRes.data ?? []

  // Build a Set of locked months in "YYYY-MM" format
  const rawMonthStatuses = monthStatusRes.data ?? []
  const lockedMonths = new Set<string>(
    rawMonthStatuses.map(
      (m) => `${m.year}-${String(m.month).padStart(2, '0')}`
    )
  )

  const nomeUtente = profile?.nome ?? authUser.email ?? 'Utente'

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarUtente nomeUtente={nomeUtente} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Ciao, {nomeUtente.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Segna la tua disponibilità per i turni di reperibilità
          </p>
        </div>

        {/* Calendario */}
        <section
          aria-labelledby="calendario-heading"
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
        >
          <h2
            id="calendario-heading"
            className="text-base font-semibold text-gray-900 mb-4"
          >
            Disponibilità
          </h2>
          <CalendarioDisponibilita
            userId={authUser.id}
            availabilityList={availabilityList}
            holidays={holidays}
            shifts={shifts}
            lockedMonths={lockedMonths}
          />
        </section>

        {/* Storico */}
        <section
          aria-labelledby="storico-heading"
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
        >
          <h2
            id="storico-heading"
            className="text-base font-semibold text-gray-900 mb-4"
          >
            Storico turni assegnati
          </h2>
          <StoricoTurni userId={authUser.id} />
        </section>
      </main>
    </div>
  )
}
