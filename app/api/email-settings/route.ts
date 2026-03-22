import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailSetting } from '@/lib/supabase/types'

export async function POST(request: Request) {
  const supabase = await createClient()

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

  // Parse body
  let body: { email?: string; descrizione?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { email, descrizione } = body

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Campo obbligatorio mancante: email' }, { status: 400 })
  }

  const trimmedEmail = email.trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: 'Formato email non valido.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('email_settings')
    .insert({
      email: trimmedEmail,
      descrizione: descrizione?.trim() || null,
      attivo: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Errore inserimento email setting:', error)
    return NextResponse.json(
      { error: 'Errore durante il salvataggio. Verifica che l\'indirizzo non sia già presente.' },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}
