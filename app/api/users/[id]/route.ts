import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@/lib/supabase/types'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Admin check
  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'ID utente mancante' }, { status: 400 })
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

  // Impedisci di disabilitare utenti admin
  const { data: targetProfile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', id)
    .maybeSingle()

  if (targetProfile?.ruolo === 'admin') {
    return NextResponse.json(
      { error: 'Non è possibile modificare lo stato di un amministratore.' },
      { status: 403 }
    )
  }

  const { data, error } = await supabase
    .from('users')
    .update({ attivo: body.attivo })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Errore aggiornamento utente:', error)
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento dell\'utente.' }, { status: 500 })
  }

  return NextResponse.json(data as User)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Admin/manager check
  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'ID utente mancante' }, { status: 400 })
  }

  // Leggi il target utente
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, attivo')
    .eq('id', id)
    .maybeSingle()

  if (!targetUser) {
    return NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 })
  }

  // Impedisci eliminazione se utente attivo
  if (targetUser.attivo === true) {
    return NextResponse.json(
      { error: 'Non è possibile eliminare un utente attivo. Disattivalo prima.' },
      { status: 403 }
    )
  }

  // Impedisci auto-eliminazione
  if (id === user.id) {
    return NextResponse.json(
      { error: 'Non puoi eliminare il tuo account.' },
      { status: 403 }
    )
  }

  // Elimina auth user tramite service client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = createServiceClient() as any
  const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(id)
  if (authDeleteError) {
    console.error('Errore eliminazione auth user:', authDeleteError)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione dell\'utente.' }, { status: 500 })
  }

  // Elimina record da public.users
  const { error: dbDeleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', id)

  if (dbDeleteError) {
    console.error('Errore eliminazione record utente:', dbDeleteError)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione del record utente.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
