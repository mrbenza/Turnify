import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { User, Area } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import ListaUtenti from '@/components/admin/utenti/ListaUtenti'

export default async function UtentiPage() {
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

  const isAdmin  = profile?.ruolo === 'admin'
  const isManager = profile?.ruolo === 'manager'

  /* ---- Users filtrati per ruolo ----
     Admin: vede manager + dipendenti (non altri admin)
     Manager: vede solo dipendenti */
  let query = supabase.from('users').select('*').order('nome', { ascending: true })
  if (isAdmin) {
    query = query.neq('ruolo', 'admin')
  } else {
    query = query.eq('ruolo', 'dipendente')
  }
  const { data: usersData } = await query

  const users = usersData ?? []

  /* ---- Aree (per filtro admin) ---- */
  const serviceClient = createServiceClient()
  const areas: Area[] = isAdmin
    ? ((await serviceClient.from('areas').select('*').order('nome')).data ?? []) as Area[]
    : []

  /* ---- Last login via service client ---- */
  const { data: authList } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
  const lastLoginMap = new Map<string, string | null>()
  for (const authUser of authList?.users ?? []) {
    lastLoginMap.set(authUser.id, authUser.last_sign_in_at ?? null)
  }

  const lastLogins = users.map((u) => ({
    id: u.id,
    last_sign_in_at: lastLoginMap.get(u.id) ?? null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} ruolo={profile?.ruolo as 'admin' | 'manager'} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Gestione utenti</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Lista dipendenti — attiva o disattiva l&apos;accesso
            </p>
          </div>

          <section
            aria-labelledby="lista-utenti-heading"
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
          >
            <h2 id="lista-utenti-heading" className="sr-only">Lista utenti</h2>
            <ListaUtenti
              initialUsers={users}
              currentUserId={authUser.id}
              lastLogins={lastLogins}
              isManager={isManager}
              areas={areas}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
