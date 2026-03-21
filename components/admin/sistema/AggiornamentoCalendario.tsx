'use client'

import { useState } from 'react'
import type { Holiday } from '@/lib/supabase/types'

interface AggiornamentoCalendarioProps {
  initialHolidays: Holiday[]
}

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
  })
}

function groupByYear(holidays: Holiday[]): [number, Holiday[]][] {
  const map = new Map<number, Holiday[]>()
  for (const h of holidays) {
    const year = h.year
    if (!map.has(year)) map.set(year, [])
    map.get(year)!.push(h)
  }
  return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
}

const CURRENT_YEAR = new Date().getFullYear()

export default function AggiornamentoCalendario({ initialHolidays }: AggiornamentoCalendarioProps) {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([CURRENT_YEAR]))

  function toggleYear(year: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  /* Import da API */
  const [importYear, setImportYear] = useState<number>(2026)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  /* Aggiunta manuale */
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDate, setAddDate] = useState('')
  const [addName, setAddName] = useState('')
  const [addMandatory, setAddMandatory] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  /* Toggle mandatory in corso (per id) */
  const [togglingId, setTogglingId] = useState<string | null>(null)

  /* Delete in corso (per id) */
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /* ---------------------------------------------------------------- */
  /* Import da Nager.Date                                              */
  /* ---------------------------------------------------------------- */
  async function handleImport() {
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: importYear }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setImportMsg({ type: 'error', text: json.error ?? 'Errore durante l\'importazione.' })
        return
      }
      const { inserted, skipped, holidays: newHolidays } = json as {
        inserted: number
        skipped: number
        holidays: Holiday[]
      }
      /* Aggiunge allo stato solo le festività davvero nuove */
      setHolidays((prev) => {
        const existingIds = new Set(prev.map((h) => h.id))
        const toAdd = newHolidays.filter((h) => !existingIds.has(h.id))
        return [...prev, ...toAdd]
      })
      const parts: string[] = []
      if (inserted > 0) parts.push(`${inserted} festività importate`)
      if (skipped > 0) parts.push(`${skipped} già presenti`)
      setImportMsg({
        type: 'success',
        text: parts.length > 0 ? parts.join(', ') + '.' : 'Nessuna nuova festività.',
      })
    } catch {
      setImportMsg({ type: 'error', text: 'Errore di rete durante l\'importazione.' })
    } finally {
      setImporting(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Toggle mandatory                                                  */
  /* ---------------------------------------------------------------- */
  async function handleToggleMandatory(holiday: Holiday) {
    setTogglingId(holiday.id)
    try {
      const res = await fetch(`/api/holidays/${holiday.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandatory: !holiday.mandatory }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('Errore toggle mandatory:', json.error)
        return
      }
      setHolidays((prev) =>
        prev.map((h) => (h.id === holiday.id ? (json as Holiday) : h))
      )
    } catch (err) {
      console.error('Errore toggle mandatory:', err)
    } finally {
      setTogglingId(null)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Delete                                                            */
  /* ---------------------------------------------------------------- */
  async function handleDelete(holiday: Holiday) {
    if (!confirm(`Eliminare la festività "${holiday.name}" (${formatDate(holiday.date)})?`)) return
    setDeletingId(holiday.id)
    try {
      const res = await fetch(`/api/holidays/${holiday.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(json.error ?? 'Errore durante l\'eliminazione.')
        return
      }
      setHolidays((prev) => prev.filter((h) => h.id !== holiday.id))
    } catch {
      alert('Errore di rete durante l\'eliminazione.')
    } finally {
      setDeletingId(null)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Aggiunta manuale                                                  */
  /* ---------------------------------------------------------------- */
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addDate || !addName.trim()) {
      setAddMsg({ type: 'error', text: 'Compila data e nome.' })
      return
    }
    setAdding(true)
    setAddMsg(null)
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: addDate, name: addName.trim(), mandatory: addMandatory }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAddMsg({ type: 'error', text: json.error ?? 'Errore durante l\'inserimento.' })
        return
      }
      const created = json as Holiday
      setHolidays((prev) => {
        const exists = prev.find((h) => h.id === created.id)
        if (exists) return prev.map((h) => (h.id === created.id ? created : h))
        return [...prev, created].sort((a, b) => a.date.localeCompare(b.date))
      })
      setAddMsg({ type: 'success', text: `Festività "${created.name}" aggiunta.` })
      setAddDate('')
      setAddName('')
      setAddMandatory(false)
    } catch {
      setAddMsg({ type: 'error', text: 'Errore di rete durante l\'inserimento.' })
    } finally {
      setAdding(false)
    }
  }

  const grouped = groupByYear(holidays)

  return (
    <div>
      {/* Intestazione */}
      <h2 className="text-base font-semibold text-gray-900 mb-1">Calendario festività</h2>
      <p className="text-sm text-gray-500 mb-5">
        Gestisci le festività italiane per tutti gli anni
      </p>

      {/* ---- Sezione import ---- */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label htmlFor="import-year" className="text-sm text-gray-700 font-medium shrink-0">
          Anno
        </label>
        <select
          id="import-year"
          value={importYear}
          onChange={(e) => setImportYear(Number(e.target.value))}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={handleImport}
          disabled={importing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
            hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-busy={importing}
        >
          {importing && (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {importing ? 'Importazione...' : 'Importa da API'}
        </button>
      </div>

      {importMsg && (
        <p
          className={`mb-4 text-sm rounded-lg px-4 py-2.5 ${
            importMsg.type === 'success'
              ? 'text-green-700 bg-green-50'
              : 'text-red-600 bg-red-50'
          }`}
          role={importMsg.type === 'error' ? 'alert' : 'status'}
        >
          {importMsg.text}
        </p>
      )}

      {/* ---- Lista festività raggruppata per anno ---- */}
      {grouped.length === 0 && (
        <p className="text-sm text-gray-400 mb-6">Nessuna festività presente.</p>
      )}

      {grouped.map(([year, items]) => {
        const isExpanded = expandedYears.has(year)
        return (
        <div key={year} className="mb-4">
          {/* Header anno — cliccabile */}
          <button
            type="button"
            onClick={() => toggleYear(year)}
            className="w-full flex items-center gap-2 mb-2 group focus:outline-none"
            aria-expanded={isExpanded}
          >
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
              {year}
            </span>
            <span className="text-xs text-gray-400 font-normal">
              {items.length} festività
            </span>
          </button>

          {isExpanded && (
          <div className="space-y-1.5 pl-1">
            {items.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl"
              >
                {/* Data */}
                <span className="text-xs font-mono text-gray-400 w-14 shrink-0">
                  {formatDate(holiday.date)}
                </span>

                {/* Nome */}
                <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">
                  {holiday.name}
                </span>

                {/* Badge / toggle mandatory */}
                {holiday.mandatory ? (
                  <button
                    onClick={() => handleToggleMandatory(holiday)}
                    disabled={togglingId === holiday.id}
                    title="Rimuovi flag comandata"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                      bg-green-50 text-green-700 border border-green-200
                      hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                      focus:outline-none focus:ring-2 focus:ring-green-400"
                    aria-label={`${holiday.name} — comandata. Clicca per rimuovere`}
                  >
                    {togglingId === holiday.id ? (
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                    )}
                    Comandata
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleMandatory(holiday)}
                    disabled={togglingId === holiday.id}
                    title="Segna come comandata"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                      bg-gray-100 text-gray-500 border border-gray-200
                      hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                      focus:outline-none focus:ring-2 focus:ring-gray-400"
                    aria-label={`${holiday.name} — non comandata. Clicca per attivare`}
                  >
                    {togglingId === holiday.id ? (
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                    )}
                    Non comandata
                  </button>
                )}

                {/* Pulsante elimina */}
                <button
                  onClick={() => handleDelete(holiday)}
                  disabled={deletingId === holiday.id}
                  title="Elimina festività"
                  className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    focus:outline-none focus:ring-2 focus:ring-red-400"
                  aria-label={`Elimina ${holiday.name}`}
                >
                  {deletingId === holiday.id ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
          )}
        </div>
        )
      })}

      {/* ---- Form aggiunta manuale (collassabile) ---- */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => { setShowAddForm((v) => !v); setAddMsg(null) }}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700
            hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-expanded={showAddForm}
        >
          <span>Aggiungi festività manualmente</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showAddForm ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAddForm && (
          <form onSubmit={handleAdd} className="px-4 py-4 space-y-3 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="add-date" className="block text-xs font-medium text-gray-600 mb-1">
                  Data
                </label>
                <input
                  id="add-date"
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800
                    focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label htmlFor="add-name" className="block text-xs font-medium text-gray-600 mb-1">
                  Nome
                </label>
                <input
                  id="add-name"
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="es. Festa patronale"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800
                    placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={addMandatory}
                onChange={(e) => setAddMandatory(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="text-sm text-gray-700">Festività comandata</span>
            </label>

            {addMsg && (
              <p
                className={`text-sm rounded-lg px-3 py-2 ${
                  addMsg.type === 'success'
                    ? 'text-green-700 bg-green-50'
                    : 'text-red-600 bg-red-50'
                }`}
                role={addMsg.type === 'error' ? 'alert' : 'status'}
              >
                {addMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-busy={adding}
            >
              {adding && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {adding ? 'Salvataggio...' : 'Aggiungi festività'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
