'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'turnify-install-prompt-dismissed'

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (standalone || sessionStorage.getItem(DISMISSED_KEY) === 'true') return

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }

    const handleInstalled = () => setInstallPrompt(null)

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function install() {
    if (!installPrompt) return

    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setInstallPrompt(null)
  }

  if (!installPrompt) return null

  return (
    <aside
      aria-label="Installa Turnify"
      className="fixed inset-x-0 bottom-0 z-[110] border-t border-blue-500 bg-blue-700 px-4 py-4 text-white shadow-[0_-8px_30px_rgba(15,23,42,0.2)] sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-4">
        <Image
          alt=""
          aria-hidden="true"
          className="hidden rounded-lg sm:block"
          height={52}
          src="/icons/icon-192.png"
          width={52}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 sm:text-base">
            Installa <strong>Turnify</strong> per un accesso più rapido e per ricevere le notifiche.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="min-h-10 rounded-md bg-white px-5 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-700"
              onClick={() => void install()}
              type="button"
            >
              Installa
            </button>
            <button
              className="min-h-10 rounded-md border border-blue-300 px-5 text-sm font-semibold text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-700"
              onClick={dismiss}
              type="button"
            >
              Non ora
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
