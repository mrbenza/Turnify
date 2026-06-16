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

const DEBUG_USERS_LIMIT = 70
const DEBUG_USER_SCAN_LIMIT = 70

function sanitizeSearch(value: string | null) {
  return (value ?? '').trim().replace(/[,%]/g, '').slice(0, 80)
}

export async function GET(request: Request) {
  const auth = await requireDebugAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const search = sanitizeSearch(searchParams.get('search'))
  const areaId = (searchParams.get('areaId') ?? '').trim()
  const serviceClient = createServiceClient()

  let usersQuery = serviceClient
    .from('users')
    .select('id, nome, email, ruolo, attivo, area_id')
    .order('nome', { ascending: true })
    .limit(DEBUG_USER_SCAN_LIMIT)

  const shouldLoadUsers = Boolean(areaId || search)
  if (areaId) usersQuery = usersQuery.eq('area_id', areaId)
  if (search) usersQuery = usersQuery.or(`nome.ilike.%${search}%,email.ilike.%${search}%`)

  const [usersResult, deliveriesResult, areasResult] = await Promise.all([
    shouldLoadUsers ? usersQuery : Promise.resolve({ data: [], error: null }),
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

  if (usersResult.error || deliveriesResult.error || areasResult.error) {
    return NextResponse.json({ error: 'Impossibile caricare la diagnostica' }, { status: 500 })
  }

  const candidateUsers = usersResult.data ?? []
  const candidateUserIds = candidateUsers.map((user) => user.id)
  const subscriptionsResult = candidateUserIds.length
    ? await serviceClient
        .from('push_subscriptions')
        .select('id, user_id, endpoint, expiration_time, user_agent, created_at, updated_at, last_seen_at, last_success_at, failure_count, revoked_at, client_mode, revoked_reason, revoked_by')
        .in('user_id', candidateUserIds)
        .order('last_seen_at', { ascending: false })
    : { data: [], error: null }

  if (subscriptionsResult.error) {
    return NextResponse.json({ error: 'Impossibile caricare la diagnostica' }, { status: 500 })
  }

  const subscriptions = subscriptionsResult.data ?? []
  const userIdsWithSubscriptions = new Set(subscriptions.map((subscription) => subscription.user_id))
  const visibleUsers = candidateUsers
    .filter((user) => userIdsWithSubscriptions.has(user.id))
    .slice(0, DEBUG_USERS_LIMIT)
  const visibleUserIds = new Set(visibleUsers.map((user) => user.id))
  const eventIds = [...new Set((deliveriesResult.data ?? []).map((delivery) => delivery.event_id))]
  const deliveryUserIds = [...new Set((deliveriesResult.data ?? [])
    .map((delivery) => delivery.user_id)
    .filter((userId): userId is string => typeof userId === 'string' && !visibleUserIds.has(userId)))]

  const [deliveryUsersResult, eventsResult] = await Promise.all([
    deliveryUserIds.length
      ? serviceClient.from('users').select('id, nome, email, ruolo, attivo, area_id').in('id', deliveryUserIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? serviceClient.from('notification_events').select('id, event_type, title, body, target_url, created_at, status, completed_at').in('id', eventIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (deliveryUsersResult.error || eventsResult.error) {
    return NextResponse.json({ error: 'Impossibile completare la diagnostica' }, { status: 500 })
  }

  const areaMap = new Map((areasResult.data ?? []).map((area) => [area.id, area.nome]))
  const userMap = new Map([
    ...visibleUsers.map((user) => [user.id, user] as const),
    ...(deliveryUsersResult.data ?? []).map((user) => [user.id, user] as const),
  ])
  const eventMap = new Map((eventsResult.data ?? []).map((event) => [event.id, event]))
  const visibleSubscriptionUserIds = new Set(visibleUsers.map((user) => user.id))

  return NextResponse.json({
    areas: areasResult.data ?? [],
    filters: {
      search,
      areaId,
      limit: DEBUG_USERS_LIMIT,
      usersLoaded: shouldLoadUsers,
      scannedUsers: candidateUsers.length,
      returnedUsers: visibleUsers.length,
    },
    users: visibleUsers.map((user) => ({
      ...user,
      area_nome: user.area_id ? areaMap.get(user.area_id) ?? null : null,
      subscriptions: subscriptions
        .filter((subscription) => subscription.user_id === user.id)
        .map((subscription) => ({
          ...subscription,
          endpoint: maskEndpoint(subscription.endpoint),
        })),
    })),
    deliveries: (deliveriesResult.data ?? []).map((delivery) => ({
      ...delivery,
      event: eventMap.get(delivery.event_id) ?? null,
      user: delivery.user_id
        ? userMap.get(delivery.user_id) ?? (visibleSubscriptionUserIds.has(delivery.user_id) ? null : null)
        : null,
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
