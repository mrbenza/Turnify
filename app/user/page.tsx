import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { User, SchedulingMode } from '@/lib/supabase/types'
import NavbarUtente from '@/components/user/NavbarUtente'
import CalendarioDisponibilita from '@/components/user/CalendarioDisponibilita'
import StoricoTurni, { type ShiftRow } from '@/components/user/StoricoTurni'

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

  const areaId = profile?.area_id ?? ''

  // Scheduling mode dall'area del dipendente
  const serviceClient = createServiceClient()
  const { data: areaConfig } = await serviceClient
    .from('areas')
    .select('scheduling_mode')
    .eq('id', areaId)
    .maybeSingle()
  const schedulingMode: SchedulingMode = (areaConfig?.scheduling_mode as SchedulingMode) ?? 'weekend_full'

  const now = new Date()

  // Calendar range: current month + next month
  const fromStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const toStr = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10)

  // Storico range: last 12 months
  const storicoFromStr = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10)
  const storicoToStr = now.toISOString().slice(0, 10)

  // All fetches in parallel
  const [availabilityRes, holidaysRes, shiftsRes, monthStatusRes, storicoShiftsRes] = await Promise.all([
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
      .eq('area_id', areaId),

    supabase
      .from('shifts')
      .select('*')
      .eq('user_id', authUser.id)
      .gte('date', storicoFromStr)
      .lte('date', storicoToStr)
      .order('date', { ascending: false }),
  ])

  // Calendar data
  const availabilityList = availabilityRes.data ?? []
  const holidays = holidaysRes.data ?? []
  const shifts = shiftsRes.data ?? []

  const allMonthStatuses = monthStatusRes.data ?? []

  const lockedMonths = new Set<string>(
    allMonthStatuses
      .filter((m) => m.status === 'locked')
      .map((m) => `${m.year}-${String(m.month).padStart(2, '0')}`)
  )

  // Storico data — join con month_status già in memoria
  const statusMap: Record<string, string> = {}
  for (const ms of allMonthStatuses) {
    statusMap[`${ms.year}-${ms.month}`] = ms.status
  }

  const storicoTurni: ShiftRow[] = (storicoShiftsRes.data ?? []).map((s) => {
    const [year, month] = s.date.split('-').map(Number)
    return { ...s, month_status_value: statusMap[`${year}-${month}`] ?? null }
  })

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
            schedulingMode={schedulingMode}
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
          <StoricoTurni turni={storicoTurni} />
        </section>
      </main>
    </div>
  )
}
