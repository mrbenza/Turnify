import { notFound, redirect } from 'next/navigation'
import NavbarAdmin from '@/components/admin/NavbarAdmin'
import NotificationDebugPanel from '@/components/admin/NotificationDebugPanel'
import { requireDebugAdmin } from '@/lib/debug-auth'

export default async function NotificationDebugPage() {
  const auth = await requireDebugAdmin()
  if (!auth.ok) {
    if (auth.status === 401) redirect('/login')
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarAdmin nomeAdmin={auth.profile.nome} ruolo="admin" />
      <div className="pb-16 lg:pl-56 lg:pb-0">
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Debug notifiche Web Push</h1>
            <p className="mt-1 text-sm text-gray-500">
              Dispositivi registrati, invii manuali e diagnostica consegne.
            </p>
          </div>
          <NotificationDebugPanel />
        </main>
      </div>
    </div>
  )
}
