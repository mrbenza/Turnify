'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Shift, ShiftType, User } from '@/lib/supabase/types'

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface ShiftWithUser extends Shift {
  userName: string
  createdByName: string
}

type DisplayRow =
  | { kind: 'weekend'; satDate: string; sunDate: string; shifts: ShiftWithUser[] }
  | { kind: 'single'; shift: ShiftWithUser }

const SHIFT_TYPE_STYLES: Record<ShiftType, string> = {
  weekend:      'bg-blue-50 text-blue-700',
  festivo:      'bg-orange-50 text-orange-700',
  reperibilita: 'bg-purple-50 text-purple-700',
}

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DAY_ABBR[dt.getDay()]} ${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`
}

function groupShifts(shifts: ShiftWithUser[]): DisplayRow[] {
  const rows: DisplayRow[] = []
  const processed = new Set<string>()

  for (const shift of shifts) {
    if (processed.has(shift.id)) continue

    if (shift.shift_type === 'weekend') {
      const [y, m, d] = shift.date.split('-').map(Number)
      const dow = new Date(y, m - 1, d).getDay()
      const satDate = dow === 6 ? shift.date : addDays(shift.date, -1)
      const sunDate = dow === 6 ? addDays(shift.date, 1) : shift.date

      const group = shifts.filter(
        (s) => s.shift_type === 'weekend' && (s.date === satDate || s.date === sunDate)
      )
      group.forEach((s) => processed.add(s.id))
      rows.push({ kind: 'weekend', satDate, sunDate, shifts: group })
    } else {
      processed.add(shift.id)
      rows.push({ kind: 'single', shift })
    }
  }

  return rows
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface ListaTurniProps {
  initialShifts: ShiftWithUser[]
  initialMonth: number
  initialYear: number
  initialLocked: boolean
  users: User[]
}

export default function ListaTurni({
  initialShifts,
  initialMonth,
  initialYear,
  initialLocked,
  users,
}: ListaTurniProps) {
  const now = new Date()
  const [filterMonth, setFilterMonth] = useState(initialMonth)
  const [filterYear, setFilterYear] = useState(initialYear)
  const [shifts, setShifts] = useState<ShiftWithUser[]>(initialShifts)
  const [locked, setLocked] = useState(initialLocked)
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null) // shift id or 'weekend-{satDate}'
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmRow, setConfirmRow] = useState<DisplayRow | null>(null)

  const userMap = new Map<string, string>(users.map((u) => [u.id, u.nome]))

  /* ---- Reload ---- */
  async function loadShifts(month: number, year: number) {
    setLoading(true)
    setErrorMsg(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

      const [shiftsRes, statusRes] = await Promise.all([
        supabase.from('shifts').select('*').gte('date', from).lte('date', to).order('date', { ascending: true }),
        supabase.from('month_status').select('status').eq('month', month + 1).eq('year', year).maybeSingle(),
      ])

      const rawShifts = (shiftsRes.data ?? []) as Shift[]
      setShifts(rawShifts.map((s) => ({
        ...s,
        userName: userMap.get(s.user_id) ?? s.user_id,
        createdByName: userMap.get(s.created_by) ?? s.created_by,
      })))
      setLocked(statusRes.data?.status === 'locked')
    } catch (err) {
      console.error('Errore caricamento turni:', err)
      setErrorMsg('Impossibile caricare i turni.')
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange(month: number, year: number) {
    setFilterMonth(month)
    setFilterYear(year)
    loadShifts(month, year)
  }

  /* ---- Remove one or more shifts ---- */
  async function handleRemove(row: DisplayRow) {
    setConfirmRow(null)
    const ids = row.kind === 'weekend' ? row.shifts.map((s) => s.id) : [row.shift.id]
    const key = row.kind === 'weekend' ? `weekend-${row.satDate}` : ids[0]
    setRemoving(key)
    setErrorMsg(null)
    try {
      for (const id of ids) {
        const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error ?? 'Errore sconosciuto')
        }
      }
      setShifts((prev) => prev.filter((s) => !ids.includes(s.id)))
    } catch (err) {
      console.error('Errore rimozione turno:', err)
      setErrorMsg('Errore durante la rimozione.')
    } finally {
      setRemoving(null)
    }
  }

  /* ---- Grouped rows ---- */
  const rows = groupShifts(shifts)

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i, label: MONTH_NAMES[i] }))
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  const Spinner = () => (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="text-sm text-gray-600 font-medium" htmlFor="filter-month">Mese:</label>
        <select
          id="filter-month"
          value={filterMonth}
          onChange={(e) => handleFilterChange(Number(e.target.value), filterYear)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <select
          value={filterYear}
          onChange={(e) => handleFilterChange(filterMonth, Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Anno"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {locked && (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Mese confermato
          </span>
        )}
      </div>

      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">{errorMsg}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
          <Spinner />Caricamento turni...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          Nessun turno per {MONTH_NAMES[filterMonth]} {filterYear}.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={`Lista turni ${MONTH_NAMES[filterMonth]} ${filterYear}`}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th scope="col" className="text-left py-2 px-0 font-semibold text-gray-400 text-xs uppercase tracking-wide">Periodo</th>
                  <th scope="col" className="text-left py-2 px-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Dipendente</th>
                  <th scope="col" className="text-left py-2 px-2 font-semibold text-gray-400 text-xs uppercase tracking-wide">Tipo</th>
                  {!locked && <th scope="col" className="py-2 px-2"><span className="sr-only">Azioni</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  if (row.kind === 'weekend') {
                    const key = `weekend-${row.satDate}`
                    const isRemoving = removing === key
                    // Unique employee names (a person can appear on both days)
                    const names = [...new Map(row.shifts.map((s) => [s.user_id, s.userName])).values()]
                    return (
                      <tr key={key} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2 px-0 whitespace-nowrap">
                          <span className="text-gray-700 font-medium">{shortDate(row.satDate)}</span>
                          <span className="text-gray-400 mx-1">–</span>
                          <span className="text-gray-700 font-medium">{shortDate(row.sunDate)}</span>
                        </td>
                        <td className="py-2 px-2 text-gray-800 font-medium">{names.join(', ')}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SHIFT_TYPE_STYLES.weekend}`}>
                            Weekend
                          </span>
                        </td>
                        {!locked && (
                          <td className="py-2 px-2 text-right">
                            {isRemoving ? (
                              <span className="text-gray-400 flex items-center justify-end gap-1"><Spinner /></span>
                            ) : (
                              <button
                                onClick={() => setConfirmRow(row)}
                                className="text-xs text-red-500 hover:text-red-700 hover:underline focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
                                aria-label={`Rimuovi weekend ${row.satDate}`}
                              >
                                Rimuovi
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  }

                  // Single shift
                  const { shift } = row
                  const isRemoving = removing === shift.id
                  return (
                    <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2 px-0 whitespace-nowrap text-gray-700 font-medium">
                        {shortDate(shift.date)}
                      </td>
                      <td className="py-2 px-2 font-medium text-gray-800">{shift.userName}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SHIFT_TYPE_STYLES[shift.shift_type]}`}>
                          {shift.shift_type === 'festivo' ? 'Festivo' : 'Reperibilità'}
                        </span>
                      </td>
                      {!locked && (
                        <td className="py-2 px-2 text-right">
                          {isRemoving ? (
                            <span className="text-gray-400 flex items-center justify-end gap-1"><Spinner /></span>
                          ) : (
                            <button
                              onClick={() => setConfirmRow(row)}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
                              aria-label={`Rimuovi turno di ${shift.userName} del ${shift.date}`}
                            >
                              Rimuovi
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-400 text-right">
            {shifts.length} {shifts.length === 1 ? 'turno' : 'turni'} · {rows.length} {rows.length === 1 ? 'riga' : 'righe'}
          </p>
        </>
      )}

      {/* Confirm dialog */}
      {confirmRow && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/20" onClick={() => setConfirmRow(null)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-5 max-w-sm w-full z-10">
            <p className="text-sm text-gray-700 mb-4">
              {confirmRow.kind === 'weekend'
                ? `Rimuovere tutti i turni del weekend ${shortDate(confirmRow.satDate)} – ${shortDate(confirmRow.sunDate)}?`
                : 'Rimuovere questo turno?'
              }
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRemove(confirmRow)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Rimuovi
              </button>
              <button
                onClick={() => setConfirmRow(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
