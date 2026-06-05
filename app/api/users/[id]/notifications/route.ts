import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, area_id')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Solo l amministratore puo revocare le notifiche.' }, { status: 403 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID utente mancante' }, { status: 400 })
  if (id === user.id) return NextResponse.json({ error: 'Non puoi revocare le notifiche del tuo account.' }, { status: 403 })

  const serviceClient = createServiceClient()
  const { data: targetProfile, error: targetError } = await serviceClient
    .from('users')
    .select('ruolo, area_id')
    .eq('id', id)
    .maybeSingle()

  if (targetError) return NextResponse.json({ error: 'Errore durante la verifica utente.' }, { status: 500 })
  if (!targetProfile) return NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 })
  if (targetProfile.ruolo === 'admin') {
    return NextResponse.json({ error: 'Non e possibile revocare notifiche di un amministratore.' }, { status: 403 })
  }
  const { data, error } = await serviceClient
    .from('push_subscriptions')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: 'manual_admin',
      revoked_by: user.id,
    })
    .eq('user_id', id)
    .is('revoked_at', null)
    .select('id')

  if (error) return NextResponse.json({ error: 'Errore durante la revoca notifiche.' }, { status: 500 })

  return NextResponse.json({ ok: true, revoked: data?.length ?? 0 })
}
