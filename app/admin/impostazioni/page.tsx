import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { SchedulingMode } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import GestioneEmail from '@/components/admin/impostazioni/GestioneEmail'
import GestioneArea from '@/components/admin/impostazioni/GestioneArea'

interface EmailSetting {
  id: string
  email: string
  descrizione: string | null
  attivo: boolean
  created_at: string
}

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

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') redirect('/user')

  const serviceClient = createServiceClient()

  /* ---- Parallel fetches ---- */
  const [emailSettingsRes, areaConfigRes] = await Promise.all([
    supabase.from('email_settings').select('*').order('created_at', { ascending: true }),
    serviceClient.from('areas').select('scheduling_mode, workers_per_day').limit(1).single(),
  ])

  const emailSettings = (emailSettingsRes.data ?? []) as EmailSetting[]
  const areaConfig = areaConfigRes.data

  const schedulingMode: SchedulingMode = (areaConfig?.scheduling_mode as SchedulingMode) ?? 'weekend_full'
  const workersPerDay: 1 | 2 = (areaConfig?.workers_per_day as 1 | 2) ?? 2

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} ruolo={profile?.ruolo as 'admin' | 'manager'} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Impostazioni</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configura la logica di turnazione e le notifiche email
            </p>
          </div>

          {/* Configurazione area */}
          <section
            aria-labelledby="area-config-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="area-config-heading" className="text-sm font-semibold text-gray-700 mb-4">
              Configurazione turni
            </h2>
            <GestioneArea
              initialSchedulingMode={schedulingMode}
              initialWorkersPerDay={workersPerDay}
            />
          </section>

          {/* Email settings */}
          <section
            aria-labelledby="email-settings-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="email-settings-heading" className="text-sm font-semibold text-gray-700 mb-4">
              Destinatari email notifiche
            </h2>
            <GestioneEmail initialSettings={emailSettings} />
          </section>

        </main>
      </div>
    </div>
  )
}
