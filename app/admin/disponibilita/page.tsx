import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User, Availability, Shift, Holiday, MonthStatus } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import CalendarioGlobale from '@/components/admin/disponibilita/CalendarioGlobale'

export default async function DisponibilitaPage() {
  const supabase = await createClient()

  /* ---- Auth ---- */
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, nome')
    .eq('id', authUser.id)
    .single<{ ruolo: string; nome: string }>()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') redirect('/user')

  /* ---- Current month ---- */
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  /* ---- Parallel fetches ---- */
  const [usersRes, availRes, shiftsRes, holidaysRes, monthStatusRes] = await Promise.all([
    supabase.from('users').select('*').eq('ruolo', 'dipendente').eq('attivo', true).order('nome'),
    supabase.from('availability').select('*').gte('date', from).lte('date', to),
    supabase.from('shifts').select('*').gte('date', from).lte('date', to),
    supabase.from('holidays').select('*').gte('date', from).lte('date', to),
    supabase.from('month_status').select('*').eq('month', month + 1).eq('year', year).single<MonthStatus>(),
  ])

  const users = usersRes.data ?? []
  const availability = availRes.data ?? []
  const shifts = shiftsRes.data ?? []
  const holidays = holidaysRes.data ?? []
  const monthStatus = monthStatusRes.data
  const isLocked = monthStatus?.status === 'locked' || monthStatus?.status === 'confirmed'

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} ruolo={profile?.ruolo as 'admin' | 'manager'} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-full px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Disponibilità globale</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Visualizza e assegna turni — solo sabati, domeniche e festività
            </p>
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
            />
          </section>
        </main>
      </div>
    </div>
  )
}
