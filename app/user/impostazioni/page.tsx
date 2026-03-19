import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@/lib/supabase/types'
import NavbarUtente from '@/components/user/NavbarUtente'
import ImpostazioniPassword from '@/components/user/ImpostazioniPassword'

export default async function ImpostazioniPage() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  // User profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single<User>()

  const nomeUtente = profile?.nome ?? authUser.email ?? 'Utente'

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarUtente nomeUtente={nomeUtente} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Heading */}
        <div>
          <Link
            href="/user"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mb-3"
          >
            ← Home
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Impostazioni</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestisci le tue preferenze account
          </p>
        </div>

        {/* Password section */}
        <section
          aria-labelledby="password-heading"
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
        >
          <h2
            id="password-heading"
            className="text-base font-semibold text-gray-900 mb-4"
          >
            Cambia password
          </h2>
          <ImpostazioniPassword />
        </section>
      </main>
    </div>
  )
}
