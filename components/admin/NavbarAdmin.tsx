'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import pkg from '@/package.json'
const version: string = pkg.version

const DEBUG_COOKIE_NAME = 'turnify_debug_enabled'

/* ------------------------------------------------------------------ */
/* Navigation item definitions                                         */
/* ------------------------------------------------------------------ */

/* Admin-only nav items (flat list — no MORE_ITEMS overflow) */
const ADMIN_NAV_ITEMS = [
  {
    href: '/admin',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/admin/utenti',
    label: 'Utenti',
    shortLabel: 'Utenti',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/disponibilita',
    label: 'Disponibilità',
    shortLabel: 'Disponib.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/aree',
    label: 'Aree',
    shortLabel: 'Aree',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/admin/equita',
    label: 'Equità',
    shortLabel: 'Equità',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    ),
  },
  {
    href: '/admin/sistema',
    label: 'Sistema',
    shortLabel: 'Sistema',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

/* Manager primary nav items (shown in bottom bar on mobile) */
const MANAGER_NAV_ITEMS = [
  {
    href: '/admin',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/admin/disponibilita',
    label: 'Disponibilità',
    shortLabel: 'Disponib.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/statistiche',
    label: 'Statistiche',
    shortLabel: 'Statistiche',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

/* Manager secondary items shown in the "Altro" overflow menu */
const MANAGER_MORE_ITEMS = [
  {
    href: '/admin/utenti',
    label: 'Utenti',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/export',
    label: 'Invio turni',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
  {
    href: '/admin/impostazioni',
    label: 'Impostazioni',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

const DEBUG_NAV_ITEMS = [
  {
    href: '/admin/test',
    label: 'Test Auth',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104c1.19-1.35 3.31-1.35 4.5 0l.614.697a2.25 2.25 0 002.198.714l.923-.21c1.787-.406 3.61.65 4.016 2.437l.21.923a2.25 2.25 0 001.243 1.53l.84.42c1.625.813 2.282 2.79 1.47 4.415l-.42.84a2.25 2.25 0 000 2.012l.42.84c.813 1.625.155 3.602-1.47 4.415l-.84.42a2.25 2.25 0 00-1.243 1.53l-.21.923c-.406 1.787-2.229 2.843-4.016 2.437l-.923-.21a2.25 2.25 0 00-2.198.714l-.614.697c-1.19 1.35-3.31 1.35-4.5 0l-.614-.697a2.25 2.25 0 00-2.198-.714l-.923.21c-1.787.406-3.61-.65-4.016-2.437l-.21-.923a2.25 2.25 0 00-1.243-1.53l-.84-.42c-1.625-.813-2.282-2.79-1.47-4.415l.42-.84a2.25 2.25 0 000-2.012l-.42-.84c-.813-1.625-.155-3.602 1.47-4.415l.84-.42a2.25 2.25 0 001.243-1.53l.21-.923c.406-1.787 2.229-2.843 4.016-2.437l.923.21a2.25 2.25 0 002.198-.714l.614-.697z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M12 9v6" />
      </svg>
    ),
  },
  {
    href: '/admin/test/notifiche',
    label: 'Test notifiche',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082A23.848 23.848 0 0118 18c-1.5-1.5-2.25-3.75-2.25-6a3.75 3.75 0 10-7.5 0c0 2.25-.75 4.5-2.25 6a23.85 23.85 0 013.143-.918m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
]

function readDebugCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some((entry) => entry === `${DEBUG_COOKIE_NAME}=1`)
}

function writeDebugCookie(enabled: boolean) {
  if (typeof document === 'undefined') return
  document.cookie = `${DEBUG_COOKIE_NAME}=${enabled ? '1' : '0'}; Path=/; Max-Age=31536000; SameSite=Lax`
}

/* ------------------------------------------------------------------ */
/* Sidebar inner content — used only on desktop (lg+)                  */
/* ------------------------------------------------------------------ */

interface SidebarContentProps {
  pathname: string
  nomeAdmin?: string
  areaNome?: string
  allNavItems: { href: string; label: string; icon: React.ReactNode }[]
  debugNavItems: { href: string; label: string; icon: React.ReactNode }[]
  showDebugToggle: boolean
  debugEnabled: boolean
  onLinkClick: () => void
  onToggleDebug: () => void
  onLogout: () => void
}

function SidebarContent({
  pathname,
  nomeAdmin,
  areaNome,
  allNavItems,
  debugNavItems,
  showDebugToggle,
  debugEnabled,
  onLinkClick,
  onToggleDebug,
  onLogout,
}: SidebarContentProps) {
  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin'
    if (href === '/admin/test') return pathname === '/admin/test'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <Image src="/logo.png" alt="Sigma" width={110} height={18} className="mb-1.5" />
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-blue-600 tracking-tight select-none">Turnify</span>
          <span className="text-xs text-gray-400">Admin Panel</span>
          <span className="text-[10px] text-gray-300 ml-auto">v{version}</span>
        </div>
      </div>

      {/* Area badge — solo per manager */}
      {areaNome && (
        <div className="mx-3 mt-3 px-3 py-1.5 rounded-lg bg-blue-50 text-xs font-medium text-blue-700 truncate">
          {areaNome}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Navigazione admin">
        {allNavItems.map((item) => {
          const active = isActive(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-400
                ${active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              <span className={active ? 'text-blue-600' : 'text-gray-400'}>
                {item.icon}
              </span>
              {item.label}
            </a>
          )
        })}

        {debugNavItems.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Debug
            </p>
            <div className="space-y-0.5">
              {debugNavItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={onLinkClick}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      focus:outline-none focus:ring-2 focus:ring-blue-400
                      ${active
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={active ? 'text-amber-600' : 'text-gray-400'}>
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom: nome admin + logout */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-2">
        {showDebugToggle && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={onToggleDebug}
              className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-pressed={debugEnabled}
            >
              <span className="font-medium">Abilita debug</span>
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${debugEnabled ? 'bg-amber-500' : 'bg-gray-200'}`}
                aria-hidden="true"
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${debugEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </span>
            </button>
          </div>
        )}
        {nomeAdmin && (
          <p className="px-3 text-xs text-gray-400 truncate" aria-label="Utente loggato">
            {nomeAdmin}
          </p>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Esci dall'account admin"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Esci
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

interface NavbarAdminProps {
  nomeAdmin?: string
  ruolo?: 'admin' | 'manager'
  /** Nome dell'area del manager — mostrato come badge nella sidebar. Solo per ruolo manager. */
  areaNome?: string
}

export default function NavbarAdmin({ nomeAdmin, ruolo, areaNome }: NavbarAdminProps) {
  const pathname = usePathname()
  const router = useRouter()
  /* moreOpen controls the "Altro" overflow sheet on mobile */
  const [moreOpen, setMoreOpen] = useState(false)
  const [debugVersion, setDebugVersion] = useState(0)
  const debugEnabled = useSyncExternalStore(
    () => () => {},
    () => {
      void debugVersion
      return readDebugCookie()
    },
    () => false
  )

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin'
    if (href === '/admin/test') return pathname === '/admin/test'
    return pathname.startsWith(href)
  }

  function handleToggleDebug() {
    const next = !debugEnabled
    writeDebugCookie(next)
    setDebugVersion((value) => value + 1)
    setMoreOpen(false)
    router.refresh()
  }

  /* Compute nav items based on role */
  const effectiveRuolo = ruolo ?? 'manager'
  const isAdmin = effectiveRuolo === 'admin'
  const debugNavItems = isAdmin && debugEnabled ? DEBUG_NAV_ITEMS : []
  const navItems = effectiveRuolo === 'admin' ? ADMIN_NAV_ITEMS : MANAGER_NAV_ITEMS
  const moreItems = effectiveRuolo === 'admin' ? debugNavItems : MANAGER_MORE_ITEMS
  const allNavItems = effectiveRuolo === 'admin' ? ADMIN_NAV_ITEMS : [...MANAGER_NAV_ITEMS, ...MANAGER_MORE_ITEMS]

  /* Is any secondary item currently active? Used to highlight "Altro" */
  const moreActive = moreItems.some((item) => isActive(item.href))

  return (
    <>
      {/* ============================================================ */}
      {/* Desktop sidebar — visible only on lg+                        */}
      {/* ============================================================ */}
      <aside
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 bg-white border-r border-gray-100 z-40"
        aria-label="Sidebar admin"
      >
        <SidebarContent
          pathname={pathname}
          nomeAdmin={nomeAdmin}
          areaNome={areaNome}
          allNavItems={allNavItems}
          debugNavItems={debugNavItems}
          showDebugToggle={isAdmin}
          debugEnabled={debugEnabled}
          onLinkClick={() => {}}
          onToggleDebug={handleToggleDebug}
          onLogout={handleLogout}
        />
      </aside>

      {/* ============================================================ */}
      {/* Mobile bottom navigation bar — hidden on lg+                  */}
      {/* ============================================================ */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb"
        aria-label="Navigazione principale"
      >
        <div className="flex items-stretch h-16">
          {/* Primary nav items */}
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <a
                key={item.href}
                href={item.href}
                className={`
                  flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px]
                  text-[10px] font-medium transition-colors
                  focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400
                  ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}
                `}
                aria-current={active ? 'page' : undefined}
              >
                <span className={active ? 'text-blue-600' : 'text-gray-400'}>
                  {item.icon}
                </span>
                <span>{item.shortLabel}</span>
              </a>
            )
          })}

          {/* "Altro" button — always shown for logout access on mobile */}
          <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px]
                text-[10px] font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400
                ${moreActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}
              `}
              aria-label={moreOpen ? 'Chiudi menu secondario' : 'Apri menu secondario'}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              {/* ··· icon */}
              <svg
                className={`w-5 h-5 ${moreActive ? 'text-blue-600' : 'text-gray-400'}`}
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
              <span>Altro</span>
            </button>
        </div>
      </nav>

      {/* ============================================================ */}
      {/* Mobile overflow sheet for secondary items                    */}
      {/* ============================================================ */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/20"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet panel — appears above the bottom nav */}
          <div
            role="menu"
            aria-label="Menu secondario"
            className="lg:hidden fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 rounded-t-2xl shadow-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1" aria-hidden="true">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Admin name + area */}
            <div className="px-5 pt-1 pb-2 border-b border-gray-100">
              {nomeAdmin && (
                <p className="text-xs text-gray-400">{nomeAdmin}</p>
              )}
              {areaNome && (
                <p className="text-xs font-medium text-blue-600 mt-0.5">{areaNome}</p>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleToggleDebug}
                  className="mt-2 w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-pressed={debugEnabled}
                >
                  <span className="font-medium">Abilita debug</span>
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${debugEnabled ? 'bg-amber-500' : 'bg-gray-200'}`}
                    aria-hidden="true"
                  >
                    <span
                      className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${debugEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                    />
                  </span>
                </button>
              )}
            </div>

            {/* Secondary links */}
            <ul className="py-2">
              {moreItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.href} role="none">
                    <a
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={`
                        flex items-center gap-4 px-5 py-3.5 text-sm font-medium transition-colors
                        focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400
                        ${active ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}
                      `}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className={active ? 'text-blue-600' : 'text-gray-400'}>
                        {item.icon}
                      </span>
                      {item.label}
                    </a>
                  </li>
                )
              })}
            </ul>

            {/* Logout */}
            <div className="border-t border-gray-100 px-5 py-3">
              <button
                onClick={() => { setMoreOpen(false); handleLogout() }}
                className="w-full flex items-center gap-4 py-2.5 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 rounded-lg"
                aria-label="Esci dall'account admin"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Esci
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
