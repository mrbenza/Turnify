import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@/lib/supabase/types'

/**
 * POST /api/users
 *
 * Crea un nuovo utente auth + profilo in un'unica operazione server-side.
 * Richiede che il chiamante sia autenticato come admin.
 *
 * Body: { nome: string, email: string, ruolo: 'dipendente' | 'manager' | 'admin' }
 * Returns: User (il record appena inserito in public.users)
 */
export async function POST(request: Request) {
  // --- 1. Verifica autenticazione con il client anon (cookie-based) ---
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // --- 2. Verifica che il chiamante sia admin ---
  const { data: callerProfile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (callerProfile?.ruolo !== 'admin' && callerProfile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // --- 3. Parsing e validazione del body ---
  let body: { nome?: unknown; email?: unknown; ruolo?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const ruolo = body.ruolo

  if (!nome || !email) {
    return NextResponse.json({ error: 'Campi obbligatori: nome, email' }, { status: 400 })
  }

  if (ruolo !== 'dipendente' && ruolo !== 'manager' && ruolo !== 'admin') {
    return NextResponse.json({ error: 'Ruolo non valido. Valori ammessi: dipendente, manager, admin' }, { status: 400 })
  }

  // Validazione email minimale
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Formato email non valido' }, { status: 400 })
  }

  // --- 4. Crea auth user con service role (la service key non lascia mai il server) ---
  const serviceClient = createServiceClient()

  const { data: defaultArea } = await serviceClient
    .from('areas')
    .select('id')
    .eq('nome', 'Default')
    .single()

  if (!defaultArea?.id) {
    return NextResponse.json({ error: 'Area Default non trovata.' }, { status: 500 })
  }

  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password: '1234',
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('Errore creazione auth user:', authError)
    // Supabase restituisce un messaggio leggibile in authError.message
    return NextResponse.json(
      { error: authError?.message ?? 'Errore durante la creazione dell\'utente auth' },
      { status: 500 }
    )
  }

  const authUserId = authData.user.id

  // --- 5. Inserisce il profilo in public.users ---
  const { data: newUser, error: dbError } = await serviceClient
    .from('users')
    .insert({ id: authUserId, nome, email, ruolo, attivo: true, area_id: defaultArea.id })
    .select()
    .single()

  if (dbError || !newUser) {
    console.error('Errore inserimento profilo utente:', dbError)
    // Rollback: elimina l'auth user appena creato per evitare utenti orfani
    await serviceClient.auth.admin.deleteUser(authUserId)
    return NextResponse.json(
      { error: dbError?.message ?? 'Errore durante il salvataggio del profilo utente' },
      { status: 500 }
    )
  }

  return NextResponse.json(newUser, { status: 201 })
}
