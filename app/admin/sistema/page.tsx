import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import GestioneTemplate from '@/components/admin/sistema/GestioneTemplate'
import AggiornamentoCalendario from '@/components/admin/sistema/AggiornamentoCalendario'
import ImportaStorico from '@/components/admin/sistema/ImportaStorico'
import ControlloStorico from '@/components/admin/sistema/ControlloStorico'
import type { Holiday } from '@/lib/supabase/types'

export interface TemplateFile {
  name: string
  updated_at?: string | null
  size?: number | null
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
  // service_role: storage.list() richiede service key
  const serviceClient = createServiceClient()
  const { data: fileList } = await serviceClient.storage.from('templates').list()
  const templates: TemplateFile[] = (fileList ?? [])
    .filter((f) => f.name.endsWith('.xlsx'))

  /* ---- Festività ---- */
  const { data: holidaysData } = await supabase
    .from('holidays')
    .select('*')
    .order('date', { ascending: true })

  const holidays = (holidaysData ?? []) as Holiday[]

  /* ---- Aree con info manager per ControlloStorico ---- */
  const { data: areasData } = await serviceClient
    .from('areas')
    .select('id, nome, storico_abilitato, manager_id')
    .order('nome', { ascending: true })

  const { data: managersData } = await serviceClient
    .from('users')
    .select('id, nome')
    .eq('ruolo', 'manager')

  const managersMap = new Map((managersData ?? []).map(m => [m.id, m.nome]))

  const storAreas = (areasData ?? []).map(a => ({
    id: a.id,
    nome: a.nome,
    storico_abilitato: a.storico_abilitato,
    manager_nome: a.manager_id ? (managersMap.get(a.manager_id) ?? null) : null,
  }))

  const anyStorAbilitata = storAreas.some(a => a.storico_abilitato)

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
                <ImportaStorico areeAbilitate={anyStorAbilitata} />
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

          <section
            aria-labelledby="controllo-storico-heading"
            className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="controllo-storico-heading" className="sr-only">Controllo importazione storico</h2>
            <ControlloStorico initialAreas={storAreas} />
          </section>

        </main>
      </div>
    </div>
  )
}
