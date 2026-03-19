import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User, Shift, MonthStatus } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import ListaTurni from '@/components/admin/turni/ListaTurni'

interface ShiftWithUser extends Shift {
  userName: string
  createdByName: string
}

export default async function TurniPage() {
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
  const month = now.getMonth()
  const year = now.getFullYear()
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  /* ---- Data ---- */
  const [usersRes, shiftsRes, monthStatusRes] = await Promise.all([
    supabase.from('users').select('*'),
    supabase.from('shifts').select('*').gte('date', from).lte('date', to).order('date', { ascending: true }),
    supabase.from('month_status').select('*').eq('month', month + 1).eq('year', year).single<MonthStatus>(),
  ])

  const users = (usersRes.data ?? []) as User[]
  const rawShifts = (shiftsRes.data ?? []) as Shift[]
  const monthStatus = monthStatusRes.data as MonthStatus | null
  const isLocked = monthStatus?.status === 'locked'

  const userMap = new Map<string, string>(users.map((u) => [u.id, u.nome]))

  const shifts: ShiftWithUser[] = rawShifts.map((s) => ({
    ...s,
    userName: userMap.get(s.user_id) ?? s.user_id,
    createdByName: userMap.get(s.created_by) ?? s.created_by,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Turni assegnati</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Lista completa dei turni con filtro per mese
            </p>
          </div>

          <section
            aria-labelledby="lista-turni-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="lista-turni-heading" className="sr-only">Lista turni</h2>
            <ListaTurni
              initialShifts={shifts}
              initialMonth={month}
              initialYear={year}
              initialLocked={isLocked}
              users={users}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
