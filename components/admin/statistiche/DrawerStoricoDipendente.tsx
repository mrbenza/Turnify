'use client'

import { useEffect, useState, useRef } from 'react'
import type { StoricoDipendente, StoricoShift } from '@/app/api/users/[id]/shifts/route'

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${String(d).padStart(2, '0')} ${MONTH_NAMES_IT[m - 1]} ${y}`
}

function ShiftBadge({ type, name }: { type: StoricoShift['shift_type']; name: string | null }) {
  if (type === 'festivo') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
        {name ?? 'Festivo'}
      </span>
    )
  }
  if (type === 'weekend') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
        Weekend
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
      Reperibilità
    </span>
  )
}

interface Props {
  userId: string | null
  onClose: () => void
}

export default function DrawerStoricoDipendente({ userId, onClose }: Props) {
  const [data, setData] = useState<StoricoDipendente | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const isOpen = Boolean(userId)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      if (!userId) { setData(null); return }
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/users/${userId}/shifts`)
        const d: StoricoDipendente = await r.json()
        setData(d)
      } catch {
        setError('Impossibile caricare lo storico.')
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  // Chiudi con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Dati grafico mensile: prendi gli ultimi 12 mesi con turni
  const chartMonths = data?.byMonth.slice(-12) ?? []
  const maxTurni = Math.max(...chartMonths.map(m => m.totale), 1)

  // Raggruppa shifts per mese per la lista
  const shiftsByMonth = new Map<string, StoricoShift[]>()
  for (const s of data?.shifts ?? []) {
    const [y, m] = s.date.split('-').map(Number)
    const key = `${MONTH_NAMES_IT[m - 1]} ${y}`
    if (!shiftsByMonth.has(key)) shiftsByMonth.set(key, [])
    shiftsByMonth.get(key)!.push(s)
  }

  const totale = data?.shifts.length ?? 0
  const festivi = data?.shifts.filter(s => s.shift_type === 'festivo').length ?? 0
  const weekend = data?.shifts.filter(s => s.shift_type === 'weekend').length ?? 0

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Storico dipendente"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Storico turni</p>
            <h2 className="text-base font-bold text-gray-900">{data?.nome ?? '—'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Caricamento…
            </div>
          )}

          {error && (
            <p className="m-5 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          {!loading && data && (
            <div className="divide-y divide-gray-50">

              {/* Riepilogo contatori */}
              <div className="px-5 py-4 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{totale}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Turni totali</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{weekend}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Weekend</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-500">{festivi}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Festivi</p>
                </div>
              </div>

              {/* Grafico per mese */}
              {chartMonths.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Turni per mese
                  </p>
                  <div className="space-y-2">
                    {chartMonths.map((m) => (
                      <div key={`${m.year}-${m.month}`} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16 shrink-0 text-right">{m.label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden relative">
                          {/* Barra totale */}
                          <div
                            className="absolute inset-y-0 left-0 bg-blue-300 rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((m.totale / maxTurni) * 100)}%` }}
                          />
                          {/* Barra festivi sovrapposta */}
                          {m.festivi > 0 && (
                            <div
                              className="absolute inset-y-0 left-0 bg-orange-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.round((m.festivi / maxTurni) * 100)}%` }}
                            />
                          )}
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-5 shrink-0">{m.totale}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-300 inline-block" />Weekend
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />Festivi
                    </span>
                  </div>
                </div>
              )}

              {/* Festività lavorate */}
              {data.byHoliday.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Festività lavorate
                  </p>
                  <div className="space-y-2">
                    {data.byHoliday.map((h) => (
                      <div key={h.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {h.mandatory && (
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" title="Obbligatoria" />
                          )}
                          <span className="text-sm text-gray-700">{h.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                          {h.count}×
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista completa turni */}
              {data.shifts.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Tutti i turni
                  </p>
                  <div className="space-y-4">
                    {Array.from(shiftsByMonth.entries()).map(([label, shifts]) => (
                      <div key={label}>
                        <p className="text-xs font-medium text-gray-400 mb-1.5">{label}</p>
                        <div className="space-y-1.5">
                          {shifts.map((s, i) => (
                            <div key={i} className="flex items-center justify-between py-1">
                              <span className="text-sm text-gray-700">{formatDate(s.date)}</span>
                              <ShiftBadge type={s.shift_type} name={s.holiday_name} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.shifts.length === 0 && (
                <p className="px-5 py-8 text-sm text-gray-400 text-center">Nessun turno registrato.</p>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  )
}
