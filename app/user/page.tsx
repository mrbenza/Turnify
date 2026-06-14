import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { User, SchedulingMode } from '@/lib/supabase/types'
import NavbarUtente from '@/components/user/NavbarUtente'
import CalendarioDisponibilita from '@/components/user/CalendarioDisponibilita'
import StoricoTurni, { type ShiftRow } from '@/components/user/StoricoTurni'
import TurniPubblicatiMini, {
  type PublishedShift,
} from '@/components/user/TurniPubblicatiMini'

type UserPageSearchParams = {
  mese?: string
}

function parsePublishedMonth(value: string | undefined) {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null

  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  return { year, month, monthKey }
}

export default async function UserPage({
  searchParams,
}: {
  searchParams?: Promise<UserPageSearchParams>
}) {
  const supabase = await createClient()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const publishedMonth = parsePublishedMonth(resolvedSearchParams?.mese)

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
  const { data: areaConfig } = await supabase
    .from('areas')
    .select('scheduling_mode, nome')
    .eq('id', areaId)
    .maybeSingle()
  const schedulingMode: SchedulingMode = (areaConfig?.scheduling_mode as SchedulingMode) ?? 'weekend_full'
  const areaNome: string | null = areaConfig?.nome ?? null

  const now = new Date()

  // Calendario: 12 mesi indietro fino a fine mese prossimo (per navigazione storica)
  const calFromStr = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10)
  const calToStr   = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10)

  // Availability: solo mese corrente + prossimo (quelli passati non sono modificabili)
  const availFromStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  // Storico list: ultimi 12 mesi (per StoricoTurni con join month_status)
  const storicoFromStr = calFromStr
  const storicoToStr   = now.toISOString().slice(0, 10)

  // All fetches in parallel
  const [availabilityRes, holidaysRes, shiftsRes, monthStatusRes, storicoShiftsRes] = await Promise.all([
    supabase
      .from('availability')
      .select('*')
      .eq('user_id', authUser.id)
      .gte('date', availFromStr)
      .lte('date', calToStr),

    supabase
      .from('holidays')
      .select('*')
      .gte('date', calFromStr)
      .lte('date', calToStr),

    supabase
      .from('shifts')
      .select('*')
      .eq('user_id', authUser.id)
      .gte('date', calFromStr)
      .lte('date', calToStr),

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
  const publishedMonthStatus = publishedMonth
    ? allMonthStatuses.find(
        (status) =>
          status.area_id === areaId &&
          status.year === publishedMonth.year &&
          status.month === publishedMonth.month
      )
    : null

  let publishedShifts: PublishedShift[] = []
  let publishedHolidays: { date: string; name: string; mandatory: boolean }[] = []

  if (publishedMonth && publishedMonthStatus?.status === 'confirmed' && areaId) {
    const serviceClient = createServiceClient()
    const daysInMonth = new Date(publishedMonth.year, publishedMonth.month, 0).getDate()
    const from = `${publishedMonth.monthKey}-01`
    const to = `${publishedMonth.monthKey}-${String(daysInMonth).padStart(2, '0')}`

    const [publishedShiftsRes, areaUsersRes, publishedHolidaysRes] = await Promise.all([
      serviceClient
        .from('shifts')
        .select('id, date, user_id, user_nome, shift_type, reperibile_order')
        .eq('area_id', areaId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
        .order('reperibile_order', { ascending: true }),

      serviceClient
        .from('users')
        .select('id, nome')
        .eq('area_id', areaId),

      serviceClient
        .from('holidays')
        .select('date, name, mandatory')
        .gte('date', from)
        .lte('date', to),
    ])

    const userNames = new Map((areaUsersRes.data ?? []).map((user) => [user.id, user.nome]))

    publishedShifts = (publishedShiftsRes.data ?? []).map((shift) => ({
      ...shift,
      user_nome: shift.user_nome ?? userNames.get(shift.user_id) ?? 'Utente',
    }))
    publishedHolidays = publishedHolidaysRes.data ?? []
  }

  const lockedMonths = new Set<string>(
    allMonthStatuses
      .filter((m) => m.status === 'locked' || m.status === 'confirmed')
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
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Ciao, {nomeUtente.split(' ')[0]}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Segna la tua disponibilità per i turni di reperibilità
            </p>
          </div>
          {areaNome && (
            <span className="text-sm text-gray-500 whitespace-nowrap">{areaNome}</span>
          )}
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
            Calendario
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

        {publishedMonth && publishedMonthStatus?.status === 'confirmed' && (
          <TurniPubblicatiMini
            year={publishedMonth.year}
            month={publishedMonth.month}
            areaNome={areaNome}
            currentUserId={authUser.id}
            shifts={publishedShifts}
            holidays={publishedHolidays}
          />
        )}

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
