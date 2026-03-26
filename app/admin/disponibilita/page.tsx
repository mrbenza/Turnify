import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { MonthStatus, SchedulingMode, Area } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import CalendarioGlobale from '@/components/admin/disponibilita/CalendarioGlobale'
import { sortByNome } from '@/lib/utils/sort'
import AreaSelector from '@/components/admin/disponibilita/AreaSelector'

export default async function DisponibilitaPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>
}) {
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

  const isAdmin = profile?.ruolo === 'admin'

  const serviceClient = createServiceClient()

  /* ---- Area selezione ---- */
  // Admin: può scegliere qualsiasi area via ?area=<id>, default alla prima
  // Manager: sempre la propria area
  let areas: Area[] = []
  if (isAdmin) {
    const { data } = await serviceClient.from('areas').select('*')
    areas = sortByNome(data ?? [])
  }

  const { area: areaParam } = await searchParams
  let areaId: string
  if (isAdmin) {
    areaId = (areaParam && areas.some((a) => a.id === areaParam))
      ? areaParam
      : (areas[0]?.id ?? profile.area_id ?? '')
  } else {
    areaId = profile.area_id ?? ''
  }

  /* ---- Nome area per badge navbar ---- */
  const { data: areaData } = await serviceClient
    .from('areas').select('nome').eq('id', areaId).maybeSingle()
  const areaNome = areaData?.nome ?? undefined

  /* ---- Current month ---- */
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  /* ---- Parallel fetches filtrate per area ---- */
  const [usersRes, availRes, shiftsRes, holidaysRes, monthStatusRes, areaConfigRes] = await Promise.all([
    supabase.from('users').select('*').eq('ruolo', 'dipendente').eq('attivo', true).eq('area_id', areaId).order('nome'),
    supabase.from('availability').select('*').eq('area_id', areaId).gte('date', from).lte('date', to),
    supabase.from('shifts').select('*').eq('area_id', areaId).gte('date', from).lte('date', to),
    supabase.from('holidays').select('*').gte('date', from).lte('date', to),
    supabase.from('month_status').select('*').eq('area_id', areaId).eq('month', month + 1).eq('year', year).maybeSingle<MonthStatus>(),
    serviceClient.from('areas').select('scheduling_mode, workers_per_day').eq('id', areaId).single(),
  ])

  const users = usersRes.data ?? []
  const availability = availRes.data ?? []
  const shifts = shiftsRes.data ?? []
  const holidays = holidaysRes.data ?? []
  const monthStatus = monthStatusRes.data
  const isLocked = monthStatus?.status === 'locked' || monthStatus?.status === 'confirmed'

  const schedulingMode: SchedulingMode = (areaConfigRes.data?.scheduling_mode as SchedulingMode) ?? 'weekend_full'
  const workersPerDay: 1 | 2 = (areaConfigRes.data?.workers_per_day as 1 | 2) ?? 2

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin
        nomeAdmin={profile?.nome}
        ruolo={profile?.ruolo as 'admin' | 'manager'}
        areaNome={areaNome}
      />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-full px-4 py-6 space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Disponibilità globale</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Visualizza e assegna turni — solo sabati, domeniche e festività
              </p>
            </div>
            {isAdmin && areas.length > 1 && (
              <AreaSelector areas={areas} selectedAreaId={areaId} />
            )}
          </div>

          <section
            aria-labelledby="calendario-globale-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="calendario-globale-heading" className="sr-only">Calendario disponibilità globale</h2>
            <CalendarioGlobale
              initialUsers={users}
              initialAvailability={availability}
              initialShifts={shifts}
              initialHolidays={holidays}
              initialMonth={month}
              initialYear={year}
              initialLocked={isLocked}
              initialConfirmed={monthStatus?.status === 'confirmed'}
              isAdmin={isAdmin}
              schedulingMode={schedulingMode}
              workersPerDay={workersPerDay}
              areaId={areaId}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
