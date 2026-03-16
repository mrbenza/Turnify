import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import ExportForm from '@/components/admin/export/ExportForm'

export default async function ExportPage() {
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

  /* ---- Users list for name resolution ---- */
  const { data: usersData } = await supabase.from('users').select('*')
  const users = (usersData ?? []) as User[]

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Export dati</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Scarica i turni del mese in formato CSV
            </p>
          </div>

          <section
            aria-labelledby="export-form-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="export-form-heading" className="text-base font-semibold text-gray-900 mb-6">
              Esporta turni
            </h2>
            <ExportForm users={users} />
          </section>
        </main>
      </div>
    </div>
  )
}
