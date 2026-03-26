import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

async function getAdminOrError(supabase: SupabaseClient<Database>): Promise<{ user: { id: string }; areaId: string } | NextResponse> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, area_id')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  if (!profile?.area_id) {
    return NextResponse.json({ error: 'Profilo utente non trovato.' }, { status: 403 })
  }

  return { user, areaId: profile.area_id }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const authResult = await getAdminOrError(supabase)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'ID mancante' }, { status: 400 })
  }

  let body: { attivo?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  if (typeof body.attivo !== 'boolean') {
    return NextResponse.json({ error: 'Campo obbligatorio: attivo (boolean)' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('email_settings')
    .update({ attivo: body.attivo })
    .eq('id', id)
    .eq('area_id', authResult.areaId)
    .select()
    .single()

  if (error) {
    console.error('Errore aggiornamento email setting:', error)
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento.' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const authResult = await getAdminOrError(supabase)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'ID mancante' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('email_settings')
    .delete()
    .eq('id', id)
    .eq('area_id', authResult.areaId)

  if (error) {
    console.error('Errore eliminazione email setting:', error)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
