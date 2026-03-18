import { createClient } from '@/lib/supabase/server'
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

  if (profile?.ruolo !== 'admin') {
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
