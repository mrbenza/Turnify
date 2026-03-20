import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import GestioneTemplate from '@/components/admin/sistema/GestioneTemplate'
import AggiornamentoCalendario from '@/components/admin/sistema/AggiornamentoCalendario'

export default async function SistemaPage() {
  const supabase = await createClient()

  /* ---- Auth ---- */
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, nome')
    .eq('id', authUser.id)
    .single<{ ruolo: string; nome: string }>()

  /* Solo admin può accedere — manager viene rediretto */
  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') redirect('/user')
  if (profile?.ruolo === 'manager') redirect('/admin/disponibilita')

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} ruolo={profile?.ruolo as 'admin' | 'manager'} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Sistema</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configurazione template e calendario festività
            </p>
          </div>

          {/* Sezione 1: Template Excel */}
          <section
            aria-labelledby="template-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="template-heading" className="sr-only">Template Excel</h2>
            <GestioneTemplate />
          </section>

          {/* Sezione 2: Aggiornamento calendario */}
          <section
            aria-labelledby="calendario-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="calendario-heading" className="sr-only">Aggiornamento calendario festività</h2>
            <AggiornamentoCalendario />
          </section>

        </main>
      </div>
    </div>
  )
}
