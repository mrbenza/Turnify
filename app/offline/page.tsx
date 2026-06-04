import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <svg
            aria-hidden="true"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.5 8.5A5 5 0 0115.5 15.5M5.6 5.6A10 10 0 0119 8m-14 8a10 10 0 011.9-2.2M12 20h.01" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Connessione assente</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Turnify richiede una connessione per mostrare e modificare i dati aggiornati.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-800"
          href="/"
        >
          Riprova
        </Link>
      </section>
    </main>
  )
}
