'use client'

export default function AggiornamentoCalendario() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-base font-semibold text-gray-900">Aggiornamento calendario festività</h2>
        {/* Status badge */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />
          In sviluppo
        </span>
      </div>

      <p className="text-sm text-gray-500 mb-5">
        Funzionalità in sviluppo — disponibile in una versione futura
      </p>

      {/* Informational note */}
      <div className="flex gap-3 bg-gray-50 rounded-xl px-4 py-3.5 mb-5" role="note">
        <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-gray-600">
          Quando disponibile, questa funzione aggiornerà automaticamente il calendario delle festività
          nazionali e comandate per l&apos;anno in corso, senza necessità di inserimento manuale.
        </p>
      </div>

      {/* Disabled button with tooltip wrapper */}
      <div className="relative inline-block group">
        <button
          disabled
          aria-disabled="true"
          aria-describedby="calendario-tooltip"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-100 text-gray-400 text-sm font-medium cursor-not-allowed select-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aggiorna calendario
        </button>

        {/* Tooltip */}
        <div
          id="calendario-tooltip"
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block
            whitespace-nowrap text-xs text-white bg-gray-700 rounded-lg px-3 py-1.5 shadow-lg pointer-events-none"
        >
          Non ancora disponibile
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
