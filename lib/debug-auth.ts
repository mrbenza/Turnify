import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function requireDebugAdmin() {
  const cookieStore = await cookies()
  if (cookieStore.get('turnify_debug_enabled')?.value !== '1') {
    return { ok: false as const, status: 404, error: 'Pagina non disponibile' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Non autenticato' }

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, nome, attivo')
    .eq('id', user.id)
    .single<{ ruolo: string; nome: string; attivo: boolean }>()

  if (profile?.ruolo !== 'admin' || !profile.attivo) {
    return { ok: false as const, status: 403, error: 'Non autorizzato' }
  }

  return { ok: true as const, user, profile }
}
