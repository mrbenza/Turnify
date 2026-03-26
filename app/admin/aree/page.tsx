import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import GestioneAree from '@/components/admin/aree/GestioneAree'
import type { Area, User } from '@/lib/supabase/types'
import { sortByNome } from '@/lib/utils/sort'

export default async function AreePage() {
  const supabase = await createClient()

  /* ---- Auth ---- */
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, nome')
    .eq('id', authUser.id)
    .single<{ ruolo: string; nome: string }>()

  /* Solo admin può accedere */
  if (!profile || profile.ruolo !== 'admin') redirect('/admin')

  /* ---- Carica aree ---- */
  const { data: areasData } = await supabase
    .from('areas')
    .select('*')
    .order('nome', { ascending: true })

  const areas: Area[] = sortByNome(areasData ?? [])

  /* ---- Carica tutti gli utenti (manager + dipendenti, non admin) ---- */
  const { data: usersData } = await supabase
    .from('users')
    .select('*')
    .neq('ruolo', 'admin')
    .order('nome', { ascending: true })

  const users: User[] = usersData ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile.nome} ruolo="admin" />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-6xl mx-auto px-4 py-6">
          <GestioneAree areas={areas} users={users} />
        </main>
      </div>
    </div>
  )
}
