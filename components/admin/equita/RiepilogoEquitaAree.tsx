'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AreaEquitySummary } from '@/app/api/equity-overview/route'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

/* Delta thresholds (score = turni + festivi×2) */
function deltaHealth(delta: number): { label: string; className: string } {
  if (delta <= 2) return { label: 'Equilibrato', className: 'bg-green-100 text-green-800' }
  if (delta <= 5) return { label: 'Da monitorare', className: 'bg-amber-100 text-amber-800' }
  return { label: 'Squilibrato', className: 'bg-red-100 text-red-800' }
}

/* ------------------------------------------------------------------ */
/* Spinner                                                             */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Expanded ranking for one area                                       */
/* ------------------------------------------------------------------ */

function AreaRanking({ summary }: { summary: AreaEquitySummary }) {
  if (summary.scores.length === 0) {
    return <p className="text-sm text-gray-400 py-3 text-center">Nessun dato per questo periodo.</p>
  }

  const sorted = [...summary.scores].sort((a, b) => a.score - b.score)
  const maxTurni = Math.max(...sorted.map((s) => s.turni_totali), 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={`Ranking equità ${summary.areaNome}`}>
        <thead>
          <tr className="border-b border-gray-100">
            <th scope="col" className="text-left py-2 px-0 text-xs font-semibold text-gray-400 uppercase tracking-wide w-6">#</th>
            <th scope="col" className="text-left py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nome</th>
            <th scope="col" className="text-left py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Turni</th>
            <th scope="col" className="text-left py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Festivi</th>
            <th scope="col" className="text-left py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</th>
            <th scope="col" className="py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left min-w-[100px]">Dist.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((s, idx) => {
            const isPriority = idx === 0
            const barWidth = maxTurni > 0 ? Math.round((s.turni_totali / maxTurni) * 100) : 0
            return (
              <tr key={s.user_id} className={isPriority ? 'bg-green-50/60' : ''}>
                <td className="py-2 px-0 text-gray-400 text-xs">{idx + 1}</td>
                <td className="py-2 px-2 font-medium text-gray-800">
                  <span className="flex items-center gap-1.5">
                    {s.nome}
                    {isPriority && (
                      <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                        Priorità
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2 px-2 text-gray-700 font-semibold">{s.turni_totali}</td>
                <td className="py-2 px-2 text-gray-500">{s.festivi}</td>
                <td className="py-2 px-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${isPriority ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {s.score}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden" aria-hidden="true">
                      <div
                        className={`h-full rounded-full ${isPriority ? 'bg-green-500' : 'bg-blue-400'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-7 text-right">{barWidth}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

interface RiepilogoEquitaAreeProps {
  initialData: AreaEquitySummary[]
  initialMonth: number
  initialYear: number
}

export default function RiepilogoEquitaAree({ initialData, initialMonth, initialYear }: RiepilogoEquitaAreeProps) {
  const now = new Date()
  const [data, setData] = useState<AreaEquitySummary[]>(initialData)
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month')
  const [filterMonth, setFilterMonth] = useState(initialMonth)
  const [filterYear, setFilterYear] = useState(initialYear)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(null)

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  const fetchData = useCallback(async (month: number, year: number, mode: 'month' | 'all') => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const p_month = mode === 'month' ? month + 1 : 0
      const res = await fetch(`/api/equity-overview?month=${p_month}&year=${year}`)
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const json: AreaEquitySummary[] = await res.json()
      setData(json)
    } catch {
      setErrorMsg('Impossibile caricare i dati.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(filterMonth, filterYear, viewMode)
  }, [filterMonth, filterYear, viewMode, fetchData])

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Intervallo temporale">
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Questo mese
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Tutti i tempi
          </button>
        </div>

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

        {loading && (
          <span className="text-gray-400 flex items-center gap-1.5 text-sm">
            <Spinner />Caricamento...
          </span>
        )}
      </div>

      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">{errorMsg}</p>
      )}

      <p className="text-xs text-gray-400 mb-4">
        {viewMode === 'month'
          ? `${MONTH_NAMES[filterMonth]} ${filterYear} — delta = differenza tra lo score più alto e il più basso nell'area`
          : `Tutti i tempi — delta = differenza tra lo score più alto e il più basso nell'area`}
      </p>

      {/* Area cards */}
      <div className="space-y-3">
        {data.map((summary) => {
          const health = deltaHealth(summary.delta)
          const isExpanded = expandedAreaId === summary.areaId

          return (
            <article
              key={summary.areaId}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Row */}
              <button
                onClick={() => setExpandedAreaId(isExpanded ? null : summary.areaId)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400"
                aria-expanded={isExpanded}
              >
                {/* Area name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{summary.areaNome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{summary.numDipendenti} dipendent{summary.numDipendenti === 1 ? 'e' : 'i'}</p>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Media</p>
                    <p className="font-semibold text-gray-700">{summary.avgScore}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Min</p>
                    <p className="font-semibold text-gray-700">{summary.minScore}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Max</p>
                    <p className="font-semibold text-gray-700">{summary.maxScore}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Delta</p>
                    <p className="font-bold text-gray-900">{summary.delta}</p>
                  </div>
                </div>

                {/* Health badge */}
                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${health.className}`}>
                  {health.label}
                </span>

                {/* Chevron */}
                <svg
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Mobile stats row */}
              <div className="sm:hidden flex items-center gap-4 px-5 pb-3 text-sm border-t border-gray-50">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Media</p>
                  <p className="font-semibold text-gray-700">{summary.avgScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Min</p>
                  <p className="font-semibold text-gray-700">{summary.minScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Max</p>
                  <p className="font-semibold text-gray-700">{summary.maxScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Delta</p>
                  <p className="font-bold text-gray-900">{summary.delta}</p>
                </div>
              </div>

              {/* Expanded ranking */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  <AreaRanking summary={summary} />
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
