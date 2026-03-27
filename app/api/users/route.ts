import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    .select('ruolo, area_id')
    .eq('id', user.id)
    .single()

  if (callerProfile?.ruolo !== 'admin' && callerProfile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // Manager deve avere un'area assegnata; admin opera globalmente senza area propria
  if (callerProfile.ruolo === 'manager' && !callerProfile.area_id) {
    return NextResponse.json({ error: 'Profilo manager non configurato: area mancante.' }, { status: 403 })
  }

  // --- 3. Parsing e validazione del body ---
  let body: { nome?: unknown; email?: unknown; ruolo?: unknown; area_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const ruoloRaw = typeof body.ruolo === 'string' ? body.ruolo : ''

  if (!nome || !email) {
    return NextResponse.json({ error: 'Campi obbligatori: nome, email' }, { status: 400 })
  }

  // Manager può creare solo dipendenti; solo admin può creare manager o admin
  const rolesAllowed: string[] = callerProfile.ruolo === 'admin'
    ? ['dipendente', 'manager', 'admin']
    : ['dipendente']

  if (!rolesAllowed.includes(ruoloRaw)) {
    return NextResponse.json(
      { error: callerProfile.ruolo === 'manager'
          ? 'Il manager può creare solo utenti con ruolo dipendente.'
          : 'Ruolo non valido. Valori ammessi: dipendente, manager, admin' },
      { status: 403 }
    )
  }

  const ruolo = ruoloRaw as import('@/lib/supabase/types').UserRole

  // Validazione email minimale
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Formato email non valido' }, { status: 400 })
  }

  // service_role: auth.admin.createUser() + INSERT users — non esposto dal client anon
  const serviceClient = createServiceClient()

  // Admin può specificare un'area diversa nel body (es. import storico); manager usa sempre la sua area
  const areaId = (callerProfile.ruolo === 'admin' && typeof body.area_id === 'string' && body.area_id)
    ? body.area_id
    : callerProfile.area_id

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
    .insert({ id: authUserId, nome, email, ruolo, attivo: true, area_id: areaId })
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
