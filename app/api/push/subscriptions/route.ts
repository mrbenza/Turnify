import { NextResponse } from 'next/server'
import { isValidPushEndpoint } from '@/lib/push/validation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type SubscriptionBody = {
  endpoint?: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: SubscriptionBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth

  if (
    typeof endpoint !== 'string'
    || !isValidPushEndpoint(endpoint)
    || typeof p256dh !== 'string'
    || typeof auth !== 'string'
    || p256dh.length > 500
    || auth.length > 500
  ) {
    return NextResponse.json({ error: 'Subscription non valida' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await serviceClient.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    expiration_time: body.expirationTime ? new Date(body.expirationTime).toISOString() : null,
    user_agent: request.headers.get('user-agent'),
    last_seen_at: now,
    revoked_at: null,
    failure_count: 0,
  }, { onConflict: 'endpoint' })

  if (error) {
    console.error('Errore salvataggio push subscription:', error)
    return NextResponse.json({ error: 'Impossibile salvare la subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, last_seen_at: now })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let endpoint = ''
  try {
    endpoint = String((await request.json()).endpoint ?? '')
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  if (!isValidPushEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Endpoint non valido' }, { status: 400 })
  }

  const { error } = await createServiceClient()
    .from('push_subscriptions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) return NextResponse.json({ error: 'Impossibile disattivare le notifiche' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
