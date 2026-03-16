import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import GestioneEmail from '@/components/admin/impostazioni/GestioneEmail'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface EmailSetting {
  id: string
  email: string
  descrizione: string | null
  attivo: boolean
  created_at: string
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function ImpostazioniPage() {
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

  /* ---- Email settings ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: emailSettingsData } = await (supabase as any)
    .from('email_settings')
    .select('*')
    .order('created_at', { ascending: true })

  const emailSettings = (emailSettingsData ?? []) as EmailSetting[]

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Impostazioni</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configura le notifiche email per i mesi confermati
            </p>
          </div>

          <section
            aria-labelledby="email-settings-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="email-settings-heading" className="sr-only">Impostazioni email</h2>
            <GestioneEmail initialSettings={emailSettings} />
          </section>

        </main>
      </div>
    </div>
  )
}
