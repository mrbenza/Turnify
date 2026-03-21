import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { User } from '@/lib/supabase/types'
import NavbarAdmin from '@/components/admin/NavbarAdmin'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  /* ---- Auth ---- */
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single<User>()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') redirect('/user')

  const isAdmin = profile?.ruolo === 'admin'

  /* ---- Dati sistema ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = createServiceClient() as any

  const [usersRes, authListRes, templateRes] = await Promise.all([
    supabase.from('users').select('ruolo, attivo'),
    isAdmin ? serviceClient.auth.admin.listUsers({ perPage: 1000 }) : Promise.resolve({ data: { users: [] } }),
    isAdmin ? serviceClient.storage.from('templates').list() : Promise.resolve({ data: [] }),
  ])

  const users = (usersRes.data ?? []) as { ruolo: string; attivo: boolean }[]

  // Admin vede manager+dipendenti; manager vede solo dipendenti
  const viewableUsers = users.filter((u) =>
    isAdmin ? u.ruolo !== 'admin' : u.ruolo === 'dipendente'
  )
  const totaleUtenti = viewableUsers.length
  const utentiAttivi = viewableUsers.filter((u) => u.attivo).length

  const authUsers = authListRes.data?.users ?? []
  const maiLoggati = authUsers.filter((u: { last_sign_in_at?: string }) => !u.last_sign_in_at).length

  const templateFiles = (templateRes.data ?? []) as { name: string; updated_at?: string }[]
  const templateAttuale = templateFiles.length > 0
    ? (templateFiles.find((f) => f.name === 'AREA4.xlsx') ?? templateFiles[0])
    : null

  const statsCards = [
    { label: 'Totale', value: totaleUtenti, color: 'text-gray-900' },
    { label: 'Attivi', value: utentiAttivi, color: 'text-green-600' },
    { label: 'Inattivi', value: totaleUtenti - utentiAttivi, color: 'text-gray-400' },
    ...(isAdmin ? [{ label: 'Mai loggati', value: maiLoggati, color: maiLoggati > 0 ? 'text-amber-600' : 'text-gray-400' }] : []),
  ]

  const roleBadges = isAdmin
    ? [
        { label: 'Area Manager', count: viewableUsers.filter((u) => u.ruolo === 'manager').length, style: 'bg-blue-50 text-blue-700' },
        { label: 'ATC', count: viewableUsers.filter((u) => u.ruolo === 'dipendente').length, style: 'bg-gray-100 text-gray-600' },
      ]
    : [
        { label: 'ATC', count: totaleUtenti, style: 'bg-gray-100 text-gray-600' },
      ]

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={profile?.nome} ruolo={profile?.ruolo as 'admin' | 'manager'} />

      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-semibold text-gray-900">Pannello di amministrazione</h1>
            <p className="text-sm text-gray-500 mt-0.5">Riepilogo sistema</p>
          </div>

          {/* Card utenti */}
          <section aria-labelledby="utenti-heading" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 id="utenti-heading" className="text-base font-semibold text-gray-900">Utenti</h2>
              <a href="/admin/utenti" className="text-xs text-blue-600 hover:underline font-medium">
                Gestisci →
              </a>
            </div>

            <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
              {statsCards.map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-3">
              {roleBadges.map(({ label, count, style }) => (
                <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${style}`}>
                  {label}
                  <span className="font-bold">{count}</span>
                </span>
              ))}
            </div>
          </section>

          {/* Card template — solo admin */}
          {isAdmin && (
            <section aria-labelledby="template-heading" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 id="template-heading" className="text-base font-semibold text-gray-900">Template Excel</h2>
                <a href="/admin/sistema" className="text-xs text-blue-600 hover:underline font-medium">
                  Gestisci →
                </a>
              </div>

              {templateAttuale ? (
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{templateAttuale.name}</p>
                    {templateAttuale.updated_at && (
                      <p className="text-xs text-gray-400">
                        Aggiornato il {new Date(templateAttuale.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-red-600">Nessun template caricato</p>
                    <p className="text-xs text-gray-400">L&apos;export Excel non sarà disponibile</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Card accessi rapidi */}
          <section aria-labelledby="accessi-heading" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 id="accessi-heading" className="text-base font-semibold text-gray-900 mb-4">Accesso rapido</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="/admin/utenti"
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
              >
                <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-800">Gestione utenti</p>
                  <p className="text-xs text-gray-400">Crea, modifica, disattiva</p>
                </div>
              </a>

              {isAdmin && (
                <a
                  href="/admin/sistema"
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
                >
                  <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Sistema</p>
                    <p className="text-xs text-gray-400">Template, calendario</p>
                  </div>
                </a>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}
