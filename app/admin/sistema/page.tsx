import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import GestioneTemplate from '@/components/admin/sistema/GestioneTemplate'
import AggiornamentoCalendario from '@/components/admin/sistema/AggiornamentoCalendario'
import ImportaStorico from '@/components/admin/sistema/ImportaStorico'
import type { Holiday } from '@/lib/supabase/types'

export interface TemplateFile {
  name: string
  updated_at?: string
  size?: number
}

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

  /* ---- Lista template dallo storage ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = createServiceClient() as any
  const { data: fileList } = await serviceClient.storage.from('templates').list()
  const templates: TemplateFile[] = (fileList ?? [])
    .filter((f: TemplateFile) => f.name.endsWith('.xlsx'))

  /* ---- Festività ---- */
  const { data: holidaysData } = await supabase
    .from('holidays')
    .select('*')
    .order('date', { ascending: true })

  const holidays = (holidaysData ?? []) as Holiday[]

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} ruolo={profile?.ruolo as 'admin' | 'manager'} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-6xl mx-auto px-4 py-6">

          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Sistema</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configurazione template e calendario festività
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* Colonna sinistra: template + storico */}
            <div className="space-y-6">
              <section
                aria-labelledby="template-heading"
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
              >
                <h2 id="template-heading" className="sr-only">Template Excel</h2>
                <GestioneTemplate initialTemplates={templates} />
              </section>

              <section
                aria-labelledby="storico-heading"
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
              >
                <h2 id="storico-heading" className="sr-only">Importa storico reperibilità</h2>
                <ImportaStorico />
              </section>
            </div>

            {/* Colonna destra: calendario festività */}
            <section
              aria-labelledby="calendario-heading"
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
            >
              <h2 id="calendario-heading" className="sr-only">Aggiornamento calendario festività</h2>
              <AggiornamentoCalendario initialHolidays={holidays} />
            </section>

          </div>

        </main>
      </div>
    </div>
  )
}
