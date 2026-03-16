'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavbarUtenteProps {
  nomeUtente: string
}

export default function NavbarUtente({ nomeUtente }: NavbarUtenteProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <span className="text-lg font-bold text-blue-600 tracking-tight select-none">
          Turnify
        </span>

        {/* Right side: nome + logout */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700 font-medium hidden sm:block">
            {nomeUtente}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="Esci dall'account"
          >
            Esci
          </button>
        </div>
      </div>
    </header>
  )
}
