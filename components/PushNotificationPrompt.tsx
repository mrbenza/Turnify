'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'turnify-notification-prompt-dismissed'
const DENIED_DISMISSED_KEY = 'turnify-notification-denied-dismissed'

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...subscription.toJSON(),
      clientMode: 'standalone',
    }),
  })
  if (!response.ok) throw new Error('Impossibile salvare la subscription')
}

async function ensureSubscription() {
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    await saveSubscription(existing)
    return
  }

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('Chiave pubblica Web Push mancante')

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  await saveSubscription(subscription)
}

export default function PushNotificationPrompt() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const authenticatedPage = pathname.startsWith('/admin') || pathname.startsWith('/user')
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

    if (!authenticatedPage || !standalone || !supported) {
      setVisible(false)
      setPermissionDenied(false)
      return
    }

    if (Notification.permission === 'granted') {
      void ensureSubscription().catch((syncError: unknown) => {
        console.error('Sincronizzazione push subscription fallita:', syncError)
      })
      setVisible(false)
      setPermissionDenied(false)
      return
    }

    if (Notification.permission === 'denied') {
      setPermissionDenied(true)
      setVisible(sessionStorage.getItem(DENIED_DISMISSED_KEY) !== 'true')
      return
    }

    setPermissionDenied(false)
    setVisible(sessionStorage.getItem(DISMISSED_KEY) !== 'true')
  }, [pathname])

  async function enableNotifications() {
    setLoading(true)
    setError('')

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        if (permission === 'denied') {
          setPermissionDenied(true)
          setVisible(true)
          return
        }
        setVisible(false)
        return
      }
      await ensureSubscription()
      setVisible(false)
    } catch {
      setError('Impossibile attivare le notifiche. Riprova dalle impostazioni del browser.')
    } finally {
      setLoading(false)
    }
  }

  function dismiss() {
    sessionStorage.setItem(permissionDenied ? DENIED_DISMISSED_KEY : DISMISSED_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className={`fixed inset-x-0 bottom-0 z-[105] border-t px-4 py-4 text-white shadow-[0_-8px_30px_rgba(15,23,42,0.2)] sm:px-6 ${permissionDenied ? 'border-amber-500 bg-amber-700' : 'border-emerald-500 bg-emerald-700'}`}>
      <div className="mx-auto max-w-3xl">
        <p className="text-sm leading-5 sm:text-base">
          {permissionDenied
            ? 'Le notifiche sono bloccate. Riattivale dalle impostazioni della PWA, del browser o del sistema operativo.'
            : 'Attiva le notifiche per sapere quando i nuovi turni sono disponibili.'}
        </p>
        {error && <p className={`mt-2 text-xs ${permissionDenied ? 'text-amber-100' : 'text-emerald-100'}`}>{error}</p>}
        <div className="mt-3 flex gap-2">
          {!permissionDenied && (
            <button
              className="min-h-10 rounded-md bg-white px-5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
              disabled={loading}
              onClick={() => void enableNotifications()}
              type="button"
            >
              {loading ? 'Attivazione...' : 'Attiva notifiche'}
            </button>
          )}
          <button
            className={`min-h-10 rounded-md border px-5 text-sm font-semibold text-white ${permissionDenied ? 'border-amber-300 hover:bg-amber-600' : 'border-emerald-300 hover:bg-emerald-600'}`}
            onClick={dismiss}
            type="button"
          >
            {permissionDenied ? 'Ho capito' : 'Non ora'}
          </button>
        </div>
      </div>
    </aside>
  )
}
