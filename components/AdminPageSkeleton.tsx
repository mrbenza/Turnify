/**
 * Skeleton shell condiviso da tutti i loading.tsx delle pagine admin.
 * Riproduce la struttura layout (sidebar desktop + bottom nav mobile + content area)
 * con blocchi animati al posto del contenuto reale.
 */

interface AdminPageSkeletonProps {
  /** Numero di righe skeleton nel content (default 3) */
  rows?: number
  /** Layout a griglia (2 colonne) invece di lista verticale */
  grid?: boolean
}

function Bar({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-gray-200 rounded-md`} />
}

function Card() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <Bar w="w-1/3" h="h-4" />
      <Bar w="w-full" h="h-3" />
      <Bar w="w-4/5" h="h-3" />
      <Bar w="w-2/3" h="h-3" />
    </div>
  )
}

export default function AdminPageSkeleton({ rows = 3, grid = false }: AdminPageSkeletonProps) {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Sidebar desktop placeholder */}
      <div className="hidden lg:block fixed inset-y-0 left-0 w-56 bg-white border-r border-gray-100 z-40" />

      {/* Content */}
      <div className="lg:pl-56 pb-16 lg:pb-0">
        <main className="max-w-6xl mx-auto px-4 py-6">
          {/* Page title */}
          <div className="mb-6 space-y-2">
            <Bar w="w-28" h="h-5" />
            <Bar w="w-52" h="h-3" />
          </div>

          {/* Content area */}
          {grid ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: rows }).map((_, i) => (
                <Card key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from({ length: rows }).map((_, i) => (
                <Card key={i} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Bottom nav mobile placeholder */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-50" />
    </div>
  )
}
