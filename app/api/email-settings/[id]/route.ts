import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailSetting } from '@/lib/supabase/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAdminOrError(supabase: any): Promise<{ user: { id: string } } | NextResponse> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  return { user }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
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

  const { data, error } = await supabase
    .from('email_settings')
    .update({ attivo: body.attivo })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Errore aggiornamento email setting:', error)
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento.' }, { status: 500 })
  }

  return NextResponse.json(data as EmailSetting)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const authResult = await getAdminOrError(supabase)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'ID mancante' }, { status: 400 })
  }

  const { error } = await supabase
    .from('email_settings')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Errore eliminazione email setting:', error)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
