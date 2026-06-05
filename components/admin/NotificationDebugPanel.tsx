'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type SubscriptionRow = {
  id: string
  endpoint: string
  expiration_time: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
  last_seen_at: string
  last_success_at: string | null
  failure_count: number
  revoked_at: string | null
  client_mode: 'standalone' | 'browser'
  revoked_reason: 'manual_user' | 'manual_admin' | 'push_service_gone' | null
  revoked_by: string | null
}

type UserRow = {
  id: string
  nome: string
  email: string
  ruolo: string
  attivo: boolean
  area_id: string | null
  subscriptions: SubscriptionRow[]
}

type DeliveryRow = {
  id: string
  status: string
  attempts: number
  last_attempt_at: string | null
  sent_at: string | null
  http_status: number | null
  error: string | null
  event: {
    title: string | null
    body: string | null
    created_at: string
  } | null
  user: { nome: string; email: string } | null
}

const STALE_DAYS = 90

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('it-IT') : 'Mai'
}

function isStale(value: string) {
  return Date.now() - new Date(value).getTime() > STALE_DAYS * 24 * 60 * 60 * 1000
}

function reasonLabel(reason: SubscriptionRow['revoked_reason']) {
  if (reason === 'manual_admin') return 'Revocata da admin'
  if (reason === 'manual_user') return 'Revocata dall utente'
  if (reason === 'push_service_gone') return 'Scaduta sul push service'
  return 'Revocata'
}

function StatusBadge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'gray' | 'blue' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    gray: 'bg-gray-50 text-gray-700 ring-gray-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  }

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  )
}

export default function NotificationDebugPanel() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [title, setTitle] = useState('Notifica di test Turnify')
  const [message, setMessage] = useState('Questa e una notifica di test.')
  const [targetUrl, setTargetUrl] = useState('/user')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/debug/notifications', { cache: 'no-store' })
    if (!response.ok) {
      setFeedback('Impossibile caricare la diagnostica.')
      setLoading(false)
      return
    }
    const data = await response.json()
    setUsers(data.users ?? [])
    setDeliveries(data.deliveries ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [load])

  const activeSubscriptionIds = useMemo(
    () => users.flatMap((user) => user.subscriptions
      .filter((subscription) => !subscription.revoked_at)
      .map((subscription) => subscription.id)),
    [users],
  )

  const standaloneActiveSubscriptionIds = useMemo(
    () => users.flatMap((user) => user.subscriptions
      .filter((subscription) => !subscription.revoked_at && subscription.client_mode === 'standalone')
      .map((subscription) => subscription.id)),
    [users],
  )

  const stats = useMemo(() => {
    const subscriptions = users.flatMap((user) => user.subscriptions)
    return {
      users: users.length,
      installed: subscriptions.filter((subscription) => subscription.client_mode === 'standalone' && !subscription.revoked_at).length,
      browser: subscriptions.filter((subscription) => subscription.client_mode === 'browser' && !subscription.revoked_at).length,
      revoked: subscriptions.filter((subscription) => subscription.revoked_at).length,
      stale: subscriptions.filter((subscription) => !subscription.revoked_at && isStale(subscription.last_seen_at)).length,
    }
  }, [users])

  function toggle(subscriptionId: string) {
    setSelected((current) => current.includes(subscriptionId)
      ? current.filter((id) => id !== subscriptionId)
      : [...current, subscriptionId])
  }

  async function send() {
    setSending(true)
    setFeedback('')
    try {
      const response = await fetch('/api/debug/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionIds: selected, title, message, url: targetUrl }),
      })
      const result = await response.json()
      setFeedback(response.ok
        ? `Accettate dal push service: ${result.sent}. Fallite: ${result.failed}.`
        : result.error ?? 'Invio non riuscito.')
      if (response.ok) void load()
    } catch {
      setFeedback('Invio non riuscito. Controlla la connessione e riprova.')
    } finally {
      setSending(false)
    }
  }

  async function revoke(subscriptionId: string) {
    setRevokingId(subscriptionId)
    setFeedback('')
    try {
      const response = await fetch('/api/debug/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', subscriptionId }),
      })
      const result = await response.json()
      setFeedback(response.ok ? 'Subscription revocata.' : result.error ?? 'Revoca non riuscita.')
      if (response.ok) {
        setSelected((current) => current.filter((id) => id !== subscriptionId))
        void load()
      }
    } catch {
      setFeedback('Revoca non riuscita. Controlla la connessione e riprova.')
    } finally {
      setRevokingId(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Caricamento diagnostica notifiche...</p>

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Utenti</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.users}</p>
        </div>
        <div className="border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">PWA attive</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{stats.installed}</p>
        </div>
        <div className="border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Browser attivi</p>
          <p className="mt-2 text-2xl font-semibold text-blue-700">{stats.browser}</p>
        </div>
        <div className="border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Vecchie</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{stats.stale}</p>
        </div>
        <div className="border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Revocate</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{stats.revoked}</p>
        </div>
      </section>

      <section className="border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Invia notifica di test</h2>
            <p className="mt-1 text-xs text-gray-500">
              Inviata indica accettazione dal push service, non conferma di visualizzazione sul dispositivo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setSelected(standaloneActiveSubscriptionIds)}
              type="button"
            >
              Seleziona PWA attive
            </button>
            <button
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setSelected(activeSubscriptionIds)}
              type="button"
            >
              Seleziona tutte attive
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-700">
            Titolo
            <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" maxLength={100} onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <label className="text-sm text-gray-700">
            Pagina da aprire
            <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" onChange={(event) => setTargetUrl(event.target.value)} value={targetUrl} />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Testo
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" maxLength={500} onChange={(event) => setMessage(event.target.value)} value={message} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="min-h-10 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            disabled={sending || selected.length === 0 || !title.trim() || !message.trim()}
            onClick={() => void send()}
            type="button"
          >
            {sending ? 'Invio...' : `Invia a ${selected.length} dispositivo/i`}
          </button>
          {feedback && <p className="text-sm text-gray-600">{feedback}</p>}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">Utenti con app e notifiche registrate</h2>
        <p className="mt-1 text-xs text-gray-500">Sono mostrati solo utenti con almeno una subscription Web Push.</p>
        <div className="mt-3 space-y-3">
          {users.length === 0 && <p className="border border-gray-200 bg-white p-4 text-sm text-gray-500">Nessun dispositivo registrato.</p>}
          {users.map((user) => (
            <article className="border border-gray-200 bg-white p-4" key={user.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{user.nome}</h3>
                  <p className="text-xs text-gray-500">{user.email} - {user.ruolo} - {user.attivo ? 'attivo' : 'inattivo'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!user.attivo && <StatusBadge tone="red">Utente inattivo</StatusBadge>}
                  <StatusBadge>{user.subscriptions.length} dispositivo/i</StatusBadge>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">Invia</th>
                      <th className="py-2 pr-3">Stato</th>
                      <th className="py-2 pr-3">Browser / dispositivo</th>
                      <th className="py-2 pr-3">Ultima attivita</th>
                      <th className="py-2 pr-3">Ultimo successo</th>
                      <th className="py-2 pr-3">Errori</th>
                      <th className="py-2 pr-3">Endpoint</th>
                      <th className="py-2">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.subscriptions.map((subscription) => {
                      const revoked = Boolean(subscription.revoked_at)
                      const stale = !revoked && isStale(subscription.last_seen_at)
                      return (
                        <tr className="border-b border-gray-100 align-top" key={subscription.id}>
                          <td className="py-3 pr-3">
                            <input aria-label={`Seleziona ${user.nome}`} checked={selected.includes(subscription.id)} disabled={revoked} onChange={() => toggle(subscription.id)} type="checkbox" />
                          </td>
                          <td className="min-w-36 py-3 pr-3">
                            <div className="flex flex-wrap gap-1">
                              <StatusBadge tone={subscription.client_mode === 'standalone' ? 'green' : 'blue'}>
                                {subscription.client_mode === 'standalone' ? 'PWA installata' : 'Browser'}
                              </StatusBadge>
                              {revoked && <StatusBadge tone="red">{reasonLabel(subscription.revoked_reason)}</StatusBadge>}
                              {stale && <StatusBadge tone="amber">Da verificare</StatusBadge>}
                            </div>
                          </td>
                          <td className="max-w-72 py-3 pr-3 text-gray-700">{subscription.user_agent ?? 'Non disponibile'}</td>
                          <td className="whitespace-nowrap py-3 pr-3 text-gray-600">{formatDate(subscription.last_seen_at)}</td>
                          <td className="whitespace-nowrap py-3 pr-3 text-gray-600">{formatDate(subscription.last_success_at)}</td>
                          <td className="py-3 pr-3 text-gray-600">{subscription.failure_count}</td>
                          <td className="py-3 font-mono text-gray-500">{subscription.endpoint}</td>
                          <td className="py-3">
                            <button
                              className="rounded-md border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              disabled={revoked || revokingId === subscription.id}
                              onClick={() => void revoke(subscription.id)}
                              type="button"
                            >
                              {revokingId === subscription.id ? 'Revoca...' : 'Revoca'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">Ultime consegne</h2>
        <div className="mt-3 overflow-x-auto border border-gray-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr><th className="p-3">Ora tentativo</th><th className="p-3">Accettata</th><th className="p-3">Utente</th><th className="p-3">Titolo</th><th className="p-3">Stato</th><th className="p-3">Tentativi</th><th className="p-3">HTTP</th><th className="p-3">Errore</th></tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr className="border-b border-gray-100" key={delivery.id}>
                  <td className="whitespace-nowrap p-3">{formatDate(delivery.last_attempt_at)}</td>
                  <td className="whitespace-nowrap p-3">{formatDate(delivery.sent_at)}</td>
                  <td className="p-3">{delivery.user?.nome ?? delivery.user?.email ?? 'Utente rimosso'}</td>
                  <td className="p-3">{delivery.event?.title ?? 'Pubblicazione turni'}</td>
                  <td className="p-3 font-semibold">{delivery.status}</td>
                  <td className="p-3">{delivery.attempts}</td>
                  <td className="p-3">{delivery.http_status ?? '-'}</td>
                  <td className="max-w-72 p-3 text-red-600">{delivery.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
