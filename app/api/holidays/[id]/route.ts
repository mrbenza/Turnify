import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Holiday } from '@/lib/supabase/types'

/**
 * PATCH /api/holidays/[id]
 * Aggiorna il campo mandatory di una festività.
 * Richiede autenticazione admin.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato — solo admin' }, { status: 403 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID festività mancante' }, { status: 400 })
  }

  let body: { mandatory?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  if (typeof body.mandatory !== 'boolean') {
    return NextResponse.json({ error: 'Campo obbligatorio: mandatory (boolean)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('holidays')
    .update({ mandatory: body.mandatory })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Errore aggiornamento festività:', error)
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento della festività' }, { status: 500 })
  }

  return NextResponse.json(data as Holiday)
}

/**
 * DELETE /api/holidays/[id]
 * Elimina una festività.
 * Verifica che non ci siano turni assegnati in quella data prima di procedere.
 * Richiede autenticazione admin.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato — solo admin' }, { status: 403 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID festività mancante' }, { status: 400 })
  }

  /* Recupera la festività per ottenere la data */
  const { data: holiday } = await supabase
    .from('holidays')
    .select('id, date')
    .eq('id', id)
    .maybeSingle()

  if (!holiday) {
    return NextResponse.json({ error: 'Festività non trovata' }, { status: 404 })
  }

  /* Verifica turni associati alla data */
  const { count } = await supabase
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .eq('date', holiday.date)

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Esistono turni assegnati in questa data' },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Errore eliminazione festività:', error)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione della festività' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
