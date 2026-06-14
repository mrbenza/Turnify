import { NextResponse } from 'next/server'
import { requireDebugAdmin } from '@/lib/debug-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendNotificationEvent } from '@/lib/push/delivery'
import { isInternalPushTarget } from '@/lib/push/validation'
import type { PushSubscription } from '@/lib/supabase/types'

const MONTH_NAMES = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]

function maskEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return `${url.origin}/…${url.pathname.slice(-12)}`
  } catch {
    return `…${endpoint.slice(-16)}`
  }
}

export async function GET() {
  const auth = await requireDebugAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const serviceClient = createServiceClient()
  const [subscriptionsResult, deliveriesResult, areasResult] = await Promise.all([
    serviceClient
      .from('push_subscriptions')
      .select('id, user_id, endpoint, expiration_time, user_agent, created_at, updated_at, last_seen_at, last_success_at, failure_count, revoked_at, client_mode, revoked_reason, revoked_by')
      .order('last_seen_at', { ascending: false }),
    serviceClient
      .from('notification_deliveries')
      .select('id, event_id, subscription_id, user_id, status, attempts, last_attempt_at, sent_at, http_status, error')
      .order('last_attempt_at', { ascending: false })
      .limit(100),
    serviceClient
      .from('areas')
      .select('id, nome')
      .order('nome', { ascending: true }),
  ])

  if (subscriptionsResult.error || deliveriesResult.error || areasResult.error) {
    return NextResponse.json({ error: 'Impossibile caricare la diagnostica' }, { status: 500 })
  }

  const subscriptions = subscriptionsResult.data ?? []
  const userIds = [...new Set(subscriptions.map((subscription) => subscription.user_id))]
  const eventIds = [...new Set((deliveriesResult.data ?? []).map((delivery) => delivery.event_id))]

  const [usersResult, eventsResult] = await Promise.all([
    userIds.length
      ? serviceClient.from('users').select('id, nome, email, ruolo, attivo, area_id').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? serviceClient.from('notification_events').select('id, event_type, title, body, target_url, created_at, status, completed_at').in('id', eventIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (usersResult.error || eventsResult.error) {
    return NextResponse.json({ error: 'Impossibile completare la diagnostica' }, { status: 500 })
  }

  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, user]))
  const eventMap = new Map((eventsResult.data ?? []).map((event) => [event.id, event]))

  return NextResponse.json({
    areas: areasResult.data ?? [],
    users: userIds.map((userId) => ({
      ...userMap.get(userId),
      subscriptions: subscriptions
        .filter((subscription) => subscription.user_id === userId)
        .map((subscription) => ({
          ...subscription,
          endpoint: maskEndpoint(subscription.endpoint),
        })),
    })),
    deliveries: (deliveriesResult.data ?? []).map((delivery) => ({
      ...delivery,
      event: eventMap.get(delivery.event_id) ?? null,
      user: delivery.user_id ? userMap.get(delivery.user_id) ?? null : null,
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireDebugAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: {
    mode?: string
    subscriptionIds?: string[]
    title?: string
    message?: string
    url?: string
    areaId?: string
    month?: number
    year?: number
    republished?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  if (body.mode === 'month-publication-test') {
    const areaId = typeof body.areaId === 'string' ? body.areaId : ''
    const month = Number(body.month)
    const year = Number(body.year)

    if (!areaId || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2024 || year > 2100) {
      return NextResponse.json({ error: 'Area, mese o anno non validi' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const monthName = MONTH_NAMES[month - 1]
    const targetUrl = `/user?mese=${year}-${String(month).padStart(2, '0')}`
    const title = body.republished
      ? `Turni di ${monthName} ${year} aggiornati`
      : `Turni di ${monthName} ${year} confermati`
    const message = body.republished
      ? `I turni di ${monthName} ${year} sono stati aggiornati. Consulta il calendario.`
      : `Turni di ${monthName} ${year} confermati. Consulta il calendario.`

    const { data: recipients, error: recipientsError } = await serviceClient
      .from('users')
      .select('id')
      .eq('area_id', areaId)
      .eq('attivo', true)
      .eq('ruolo', 'dipendente')

    if (recipientsError) {
      return NextResponse.json({ error: 'Impossibile caricare i destinatari' }, { status: 500 })
    }

    const recipientIds = (recipients ?? []).map((recipient) => recipient.id)
    const { data: subscriptions, error: subscriptionsError } = recipientIds.length
      ? await serviceClient
          .from('push_subscriptions')
          .select('*')
          .in('user_id', recipientIds)
          .eq('client_mode', 'standalone')
          .is('revoked_at', null)
      : { data: [], error: null }

    if (subscriptionsError) {
      return NextResponse.json({ error: 'Impossibile caricare le subscription' }, { status: 500 })
    }

    if (!subscriptions?.length) {
      return NextResponse.json({ error: 'Nessuna subscription PWA attiva per questa area' }, { status: 400 })
    }

    const { data: event, error: eventError } = await serviceClient
      .from('notification_events')
      .insert({
        event_type: 'test',
        area_id: null,
        month: null,
        year: null,
        publication_number: null,
        created_by: auth.user.id,
        title,
        body: message,
        target_url: targetUrl,
        status: 'sending',
      })
      .select()
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Impossibile creare evento di test pubblicazione' }, { status: 500 })
    }

    const result = await sendNotificationEvent(
      serviceClient,
      event,
      subscriptions as PushSubscription[],
      { title, body: message, url: targetUrl },
    )

    return NextResponse.json({
      ok: true,
      event_id: event.id,
      recipients: recipientIds.length,
      subscriptions: subscriptions.length,
      target_url: targetUrl,
      ...result,
    })
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : ''
  const targetUrl = typeof body.url === 'string' ? body.url.trim() || '/user' : '/user'
  const subscriptionIds = Array.isArray(body.subscriptionIds)
    ? [...new Set(body.subscriptionIds.filter((id): id is string => typeof id === 'string'))].slice(0, 100)
    : []

  if (!title || !message || subscriptionIds.length === 0 || !isInternalPushTarget(targetUrl)) {
    return NextResponse.json({ error: 'Destinatari, titolo, testo o destinazione non validi' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data: subscriptions, error: subscriptionsError } = await serviceClient
    .from('push_subscriptions')
    .select('*')
    .in('id', subscriptionIds)
    .is('revoked_at', null)

  if (subscriptionsError || !subscriptions?.length) {
    return NextResponse.json({ error: 'Nessuna subscription attiva selezionata' }, { status: 400 })
  }

  const { data: event, error: eventError } = await serviceClient
    .from('notification_events')
    .insert({
      event_type: 'test',
      area_id: null,
      month: null,
      year: null,
      publication_number: null,
      created_by: auth.user.id,
      title,
      body: message,
      target_url: targetUrl,
      status: 'sending',
    })
    .select()
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Impossibile creare evento di test' }, { status: 500 })
  }

  const result = await sendNotificationEvent(
    serviceClient,
    event,
    subscriptions as PushSubscription[],
    { title, body: message, url: targetUrl },
  )

  return NextResponse.json({ ok: true, event_id: event.id, ...result })
}

export async function PATCH(request: Request) {
  const auth = await requireDebugAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { subscriptionId?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  if (body.action !== 'revoke' || typeof body.subscriptionId !== 'string' || !body.subscriptionId) {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }

  const { data, error } = await createServiceClient()
    .from('push_subscriptions')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: 'manual_admin',
      revoked_by: auth.user.id,
    })
    .eq('id', body.subscriptionId)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Impossibile revocare la subscription' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Subscription non trovata' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const auth = await requireDebugAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { subscriptionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  if (typeof body.subscriptionId !== 'string' || !body.subscriptionId) {
    return NextResponse.json({ error: 'Subscription non valida' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data: subscription, error: readError } = await serviceClient
    .from('push_subscriptions')
    .select('id, revoked_at')
    .eq('id', body.subscriptionId)
    .maybeSingle()

  if (readError) return NextResponse.json({ error: 'Impossibile verificare la subscription' }, { status: 500 })
  if (!subscription) return NextResponse.json({ error: 'Subscription non trovata' }, { status: 404 })
  if (!subscription.revoked_at) {
    return NextResponse.json({ error: 'Revoca la subscription prima di eliminarla' }, { status: 400 })
  }

  const { error: deleteError } = await serviceClient
    .from('push_subscriptions')
    .delete()
    .eq('id', body.subscriptionId)

  if (deleteError) return NextResponse.json({ error: 'Impossibile eliminare la subscription' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
