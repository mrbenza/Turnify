import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const serviceClient = createServiceClient()
  const now = new Date().toISOString()

  const { error } = await serviceClient
    .from('users')
    .update({ last_login_at: now })
    .eq('id', user.id)

  if (error) {
    console.error('Errore aggiornamento last_login_at:', error)
    return NextResponse.json({ error: 'Impossibile aggiornare il login' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, last_login_at: now })
}
