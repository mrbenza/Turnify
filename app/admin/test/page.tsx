import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import AuthDebugPanel from '@/components/admin/AuthDebugPanel'

export default async function AdminTestPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, nome')
    .eq('id', authUser.id)
    .single<{ ruolo: string; nome: string }>()

  if (profile?.ruolo !== 'admin') redirect('/user')

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} ruolo="admin" />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Test Auth</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Prove manuali su Supabase Auth Admin API senza toccare la pagina utenti.
            </p>
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
            <AuthDebugPanel />
          </section>
        </main>
      </div>
    </div>
  )
}
