import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User, UserRole } from '@/lib/supabase/types'

const VALID_ROLES = ['dipendente', 'manager', 'admin'] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

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

  const serviceClient = createServiceClient()

  let body: { attivo?: boolean; ruolo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  /* ---------------------------------------------------------------- */
  /* Handle ruolo change                                               */
  /* ---------------------------------------------------------------- */
  if (body.ruolo !== undefined) {
    // Solo admin può cambiare ruoli, non il manager
    if (profile?.ruolo !== 'admin') {
      return NextResponse.json({ error: 'Solo l\'amministratore può modificare i ruoli.' }, { status: 403 })
    }

    // Valida il valore del ruolo
    if (!VALID_ROLES.includes(body.ruolo as UserRole)) {
      return NextResponse.json(
        { error: `Ruolo non valido. Valori ammessi: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    // Impedisci di cambiare il proprio ruolo
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Non puoi modificare il tuo ruolo.' },
        { status: 403 }
      )
    }

    const { data, error } = await serviceClient
      .from('users')
      .update({ ruolo: body.ruolo as UserRole })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Errore aggiornamento ruolo:', error)
      return NextResponse.json({ error: 'Errore durante l\'aggiornamento del ruolo.' }, { status: 500 })
    }

    // Sincronizza areas.manager_id
    if (body.ruolo === 'manager' && data?.area_id) {
      // Diventa manager → assegnalo come manager dell'area
      await serviceClient
        .from('areas')
        .update({ manager_id: id })
        .eq('id', data.area_id)
    } else if (body.ruolo !== 'manager') {
      // Non è più manager → rimuovilo da manager_id se ci era
      await serviceClient
        .from('areas')
        .update({ manager_id: null })
        .eq('manager_id', id)
    }

    return NextResponse.json(data)
  }

  /* ---------------------------------------------------------------- */
  /* Handle attivo change                                              */
  /* ---------------------------------------------------------------- */
  if (body.attivo !== undefined) {
    if (typeof body.attivo !== 'boolean') {
      return NextResponse.json({ error: 'Campo obbligatorio: attivo (boolean)' }, { status: 400 })
    }

    // Impedisci di disabilitare utenti admin; controlla anche area per i manager
    const { data: targetProfile } = await serviceClient
      .from('users')
      .select('ruolo, area_id')
      .eq('id', id)
      .maybeSingle()

    if (!targetProfile) {
      return NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 })
    }

    if (targetProfile.ruolo === 'admin') {
      return NextResponse.json(
        { error: 'Non è possibile modificare lo stato di un amministratore.' },
        { status: 403 }
      )
    }

    // Manager: può agire solo sulla propria area
    if (profile?.ruolo === 'manager') {
      const { data: callerProfile } = await supabase
        .from('users')
        .select('area_id')
        .eq('id', user.id)
        .single()
      if (targetProfile.area_id !== callerProfile?.area_id) {
        return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 })
      }
    }

    const update: Partial<Omit<User, 'id'>> = { attivo: body.attivo }
    if (!body.attivo) {
      update.disattivato_at = new Date().toISOString()
    } else {
      update.disattivato_at = null
    }

    const { data, error } = await serviceClient
      .from('users')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Errore aggiornamento utente:', error)
      return NextResponse.json({ error: 'Errore durante l\'aggiornamento dell\'utente.' }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  /* ---------------------------------------------------------------- */
  /* Neither field provided                                            */
  /* ---------------------------------------------------------------- */
  return NextResponse.json(
    { error: 'Almeno un campo deve essere presente: attivo o ruolo' },
    { status: 400 }
  )
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Solo admin può eliminare
  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Solo l\'amministratore può eliminare utenti.' }, { status: 403 })
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
  const serviceClient = createServiceClient()
  const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(id)
  if (authDeleteError) {
    console.error('Errore eliminazione auth user:', authDeleteError)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione dell\'utente.' }, { status: 500 })
  }

  // Elimina record da public.users (cascade da auth.users potrebbe già averlo fatto)
  const { error: dbDeleteError } = await serviceClient
    .from('users')
    .delete()
    .eq('id', id)

  if (dbDeleteError) {
    console.error('Errore eliminazione record utente:', dbDeleteError)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione del record utente.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
