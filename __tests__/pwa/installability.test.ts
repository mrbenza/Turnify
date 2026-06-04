import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const serviceWorker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')
const installPrompt = readFileSync(
  resolve(process.cwd(), 'components/PwaInstallPrompt.tsx'),
  'utf8',
)

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
})
