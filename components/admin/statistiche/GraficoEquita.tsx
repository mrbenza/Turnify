'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EquityScore } from '@/lib/supabase/types'
import DrawerStoricoDipendente from './DrawerStoricoDipendente'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface GraficoEquitaProps {
  initialScores: EquityScore[]
  initialMonth: number
  initialYear: number
  areaId?: string
}

export default function GraficoEquita({ initialScores, initialMonth, initialYear, areaId }: GraficoEquitaProps) {
  const now = new Date()
  const [scores, setScores] = useState<EquityScore[]>(initialScores)
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month')
  const [filterMonth, setFilterMonth] = useState(initialMonth)
  const [filterYear, setFilterYear] = useState(initialYear)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  async function fetchScores(month: number, year: number, mode: 'month' | 'all') {
    setLoading(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_equity_scores', {
        p_month: mode === 'month' ? month + 1 : 0,
        p_year: year,
        ...(areaId ? { p_area_id: areaId } : {}),
      })
      if (error) throw error
      setScores(data ?? [])
    } catch (err) {
      console.error('Errore caricamento statistiche:', err)
      setErrorMsg('Impossibile caricare le statistiche di equità.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScores(filterMonth, filterYear, viewMode)
  }, [filterMonth, filterYear, viewMode]) // fetchScores is defined inside component intentionally

  /* Sort by score ascending (lower score = priority) */
  const sorted = [...scores].sort((a, b) => a.score - b.score)
  const maxTurni = Math.max(...sorted.map((s) => s.turni_totali), 1)

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  const Spinner = () => (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Toggle month vs all time */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Intervallo temporale">
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 ${
              viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Questo mese
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 ${
              viewMode === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Tutti i tempi
          </button>
        </div>

        {/* Month/year filters (only when month mode) */}
        {viewMode === 'month' && (
          <>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Mese"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Anno"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        )}

        {loading && <span className="text-gray-400 flex items-center gap-1.5 text-sm"><Spinner />Caricamento...</span>}
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Context label */}
      <p className="text-xs text-gray-400 mb-4">
        {viewMode === 'month'
          ? `Statistiche per ${MONTH_NAMES[filterMonth]} ${filterYear} — ordinato per priorità (score più basso in cima)`
          : 'Tutti i turni storici — ordinato per priorità (score più basso in cima)'}
      </p>

      {/* Empty state */}
      {!loading && sorted.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">Nessun dato disponibile per il periodo selezionato.</p>
      )}

      {/* Mobile cards (< sm) */}
      {sorted.length > 0 && (
        <div className="sm:hidden space-y-3" aria-label="Statistiche equità turni">
          {sorted.map((s, idx) => {
            const isPriority = idx === 0
            const barWidth = maxTurni > 0 ? Math.round((s.turni_totali / maxTurni) * 100) : 0

            return (
              <div
                key={s.user_id}
                onClick={() => setSelectedUserId(s.user_id)}
                className={`rounded-xl border p-4 cursor-pointer transition-shadow hover:shadow-md ${isPriority ? 'bg-green-50/60 border-green-200' : 'bg-white border-gray-100'}`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium w-5 text-center">{idx + 1}</span>
                    <span className="text-sm font-semibold text-gray-800">{s.nome}</span>
                    {isPriority && (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                        Priorità
                      </span>
                    )}
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isPriority ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {s.score.toFixed(2)}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Turni tot.</p>
                    <p className="font-semibold text-gray-700">{s.turni_totali}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Festivi</p>
                    <p className="font-semibold text-gray-700">{s.festivi}</p>
                  </div>
                </div>

                {/* Distribution bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full rounded-full transition-all ${isPriority ? 'bg-green-500' : 'bg-blue-400'}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{barWidth}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Desktop table (sm+) */}
      {sorted.length > 0 && (
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm" aria-label="Tabella equità turni">
            <thead>
              <tr className="border-b border-gray-100">
                <th scope="col" className="text-left py-2.5 px-0 font-semibold text-gray-500 text-xs uppercase tracking-wide">#</th>
                <th scope="col" className="text-left py-2.5 px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nome</th>
                <th scope="col" className="text-left py-2.5 px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Turni tot.</th>
                <th scope="col" className="text-left py-2.5 px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Festivi</th>
                <th scope="col" className="text-left py-2.5 px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Score</th>
                <th scope="col" className="py-2.5 px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide text-left">Distribuzione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((s, idx) => {
                const isPriority = idx === 0
                const barWidth = maxTurni > 0 ? Math.round((s.turni_totali / maxTurni) * 100) : 0

                return (
                  <tr
                    key={s.user_id}
                    onClick={() => setSelectedUserId(s.user_id)}
                    className={`transition-colors cursor-pointer ${isPriority ? 'bg-green-50/60 hover:bg-green-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-3 px-0 text-gray-400 font-medium text-xs">{idx + 1}</td>
                    <td className="py-3 px-2 font-medium text-gray-800">
                      <span className="flex items-center gap-1.5">
                        {s.nome}
                        {isPriority && (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                            Priorità
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-700 font-semibold">{s.turni_totali}</td>
                    <td className="py-3 px-2 text-gray-500">{s.festivi}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isPriority ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {s.score.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-2 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden" aria-hidden="true">
                          <div
                            className={`h-full rounded-full transition-all ${isPriority ? 'bg-green-500' : 'bg-blue-400'}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{barWidth}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <DrawerStoricoDipendente
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  )
}
