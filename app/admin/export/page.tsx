import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') redirect('/user')

  /* ---- Users list + template list ---- */
  const serviceClient = createServiceClient()
  const [usersRes, templatesRes] = await Promise.all([
    supabase.from('users').select('*'),
    serviceClient.storage.from('templates').list(),
  ])

  const users = usersRes.data ?? []
  const templates = ((templatesRes.data ?? []) as { name: string }[])
    .filter((f) => f.name.endsWith('.xlsx'))

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} ruolo={profile?.ruolo as 'admin' | 'manager'} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Invio turni</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Verifica, genera e invia il file Excel del mese
            </p>
          </div>

          <section
            aria-labelledby="export-form-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="export-form-heading" className="sr-only">Invio turni</h2>
            <ExportForm users={users} templates={templates} />
          </section>
        </main>
      </div>
    </div>
  )
}
