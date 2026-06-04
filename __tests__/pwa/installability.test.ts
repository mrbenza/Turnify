import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const serviceWorker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')
const installPrompt = readFileSync(
  resolve(process.cwd(), 'components/PwaInstallPrompt.tsx'),
  'utf8',
)
const notificationPrompt = readFileSync(
  resolve(process.cwd(), 'components/PushNotificationPrompt.tsx'),
  'utf8',
)
const serviceWorkerSource = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

describe('PWA installability', () => {
  it('provides all manifest icons', () => {
    for (const icon of [
      'public/icons/icon-192.png',
      'public/icons/icon-512.png',
      'public/icons/icon-maskable-512.png',
    ]) {
      expect(existsSync(resolve(process.cwd(), icon))).toBe(true)
    }
  })

  it('keeps API and authenticated data out of the static cache', () => {
    expect(serviceWorker).toContain("url.pathname.startsWith('/api/')")
    expect(serviceWorker).toContain("request.mode === 'navigate'")
    expect(serviceWorker).toContain("caches.match(OFFLINE_URL)")
  })

  it('offers installation only through the browser install event', () => {
    expect(installPrompt).toContain("'beforeinstallprompt'")
    expect(installPrompt).toContain('event.preventDefault()')
    expect(installPrompt).toContain('await installPrompt.prompt()')
    expect(installPrompt).toContain("'appinstalled'")
    expect(installPrompt).toContain("pathname.startsWith('/admin')")
    expect(installPrompt).toContain("pathname.startsWith('/user')")
  })

  it('requests notification permission only after an explicit action in standalone mode', () => {
    expect(notificationPrompt).toContain("matchMedia('(display-mode: standalone)')")
    expect(notificationPrompt).toContain('Notification.requestPermission()')
    expect(notificationPrompt).toContain('registration.pushManager.subscribe')
    expect(notificationPrompt).toContain("fetch('/api/push/subscriptions'")
  })

  it('shows pushes and opens their target page', () => {
    expect(serviceWorkerSource).toContain("self.addEventListener('push'")
    expect(serviceWorkerSource).toContain('self.registration.showNotification')
    expect(serviceWorkerSource).toContain("action: 'open'")
    expect(serviceWorkerSource).toContain('renotify: true')
    expect(serviceWorkerSource).toContain("self.addEventListener('notificationclick'")
    expect(serviceWorkerSource).toContain('self.clients.openWindow')
  })
})
