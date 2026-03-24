'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { version } from '@/package.json'

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

/* ------------------------------------------------------------------ */
/* Sidebar inner content — used only on desktop (lg+)                  */
/* ------------------------------------------------------------------ */

interface SidebarContentProps {
  pathname: string
  nomeAdmin?: string
  allNavItems: { href: string; label: string; icon: React.ReactNode }[]
  onLinkClick: () => void
  onLogout: () => void
}

function SidebarContent({ pathname, nomeAdmin, allNavItems, onLinkClick, onLogout }: SidebarContentProps) {
  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin'
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
      </nav>

      {/* Bottom: nome admin + logout */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-2">
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
}

export default function NavbarAdmin({ nomeAdmin, ruolo }: NavbarAdminProps) {
  const pathname = usePathname()
  const router = useRouter()
  /* moreOpen controls the "Altro" overflow sheet on mobile */
  const [moreOpen, setMoreOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  /* Compute nav items based on role */
  const effectiveRuolo = ruolo ?? 'manager'
  const navItems = effectiveRuolo === 'admin' ? ADMIN_NAV_ITEMS : MANAGER_NAV_ITEMS
  const moreItems = effectiveRuolo === 'admin' ? [] : MANAGER_MORE_ITEMS
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
          allNavItems={allNavItems}
          onLinkClick={() => {}}
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

            {/* Admin name */}
            {nomeAdmin && (
              <p className="px-5 pt-1 pb-2 text-xs text-gray-400 border-b border-gray-100">
                {nomeAdmin}
              </p>
            )}

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
