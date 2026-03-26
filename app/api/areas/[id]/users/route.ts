import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAuthProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('users').select('ruolo, area_id').eq('id', user.id).single()
  return { user, profile }
}

/**
 * GET /api/areas/[id]/users
 * Lista utenti dell'area. Richiede ruolo admin o manager.
 * Ritorna utenti con area_id = id, ordinati per ruolo poi nome.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthProfile()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { id } = await params

  // Manager: può leggere solo la propria area
  if (profile?.ruolo === 'manager' && profile.area_id !== id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // service_role: SELECT users cross-area (admin vede tutte le aree)
  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from('users')
    .select('*')
    .eq('area_id', id)
    .order('ruolo', { ascending: true })
    .order('nome', { ascending: true })

  if (error) {
    console.error('Errore lettura utenti area:', error)
    return NextResponse.json({ error: 'Errore durante il recupero degli utenti' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

/**
 * PATCH /api/areas/[id]/users
 * Sposta un utente in questa area. Richiede ruolo admin.
 * Body: { user_id: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthProfile()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato — richiesto ruolo admin' }, { status: 403 })
  }

  const { id } = await params

  let body: { user_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!user_id) {
    return NextResponse.json({ error: 'Il campo "user_id" è obbligatorio' }, { status: 400 })
  }

  // service_role: UPDATE users.area_id — RLS su users non prevede write per admin tramite client normale
  const serviceClient = createServiceClient()

  // Verifica che l'area di destinazione esista
  const { data: area, error: areaError } = await serviceClient
    .from('areas')
    .select('id')
    .eq('id', id)
    .single()

  if (areaError || !area) {
    return NextResponse.json({ error: 'Area non trovata' }, { status: 404 })
  }

  const { data, error } = await serviceClient
    .from('users')
    .update({ area_id: id })
    .eq('id', user_id)
    .select()
    .single()

  if (error) {
    console.error('Errore spostamento utente:', error)
    return NextResponse.json({ error: 'Errore durante lo spostamento dell\'utente' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
  }

  return NextResponse.json(data)
}
