function Bar({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-gray-200 rounded-md`} />
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-14 bg-white border-b border-gray-100" />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <Bar w="w-1/3" h="h-4" />
          <Bar w="w-full" h="h-3" />
          <Bar w="w-4/5" h="h-3" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <Bar w="w-1/4" h="h-4" />
          <Bar w="w-full" h="h-3" />
          <Bar w="w-3/5" h="h-3" />
        </div>
      </main>
    </div>
  )
}
