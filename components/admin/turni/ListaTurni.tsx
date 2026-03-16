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

const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  weekend: 'Weekend',
  festivo: 'Festivo',
  reperibilita: 'Reperibilità',
}

const SHIFT_TYPE_STYLES: Record<ShiftType, string> = {
  weekend: 'bg-blue-50 text-blue-700',
  festivo: 'bg-orange-50 text-orange-700',
  reperibilita: 'bg-purple-50 text-purple-700',
}

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getDayName(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return DAY_NAMES[new Date(year, month - 1, day).getDay()]
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
  const [removing, setRemoving] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null) // shift id

  const userMap = new Map<string, string>(users.map((u) => [u.id, u.nome]))

  /* ---- Reload when filter changes ---- */
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
        supabase.from('month_status').select('status').eq('month', month + 1).eq('year', year).single(),
      ])

      const rawShifts = (shiftsRes.data ?? []) as Shift[]
      const enriched: ShiftWithUser[] = rawShifts.map((s) => ({
        ...s,
        userName: userMap.get(s.user_id) ?? s.user_id,
        createdByName: userMap.get(s.created_by) ?? s.created_by,
      }))
      setShifts(enriched)
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

  /* ---- Remove shift ---- */
  async function handleRemove(shiftId: string) {
    setConfirmRemove(null)
    setRemoving(shiftId)
    setErrorMsg(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
      if (error) throw error
      setShifts((prev) => prev.filter((s) => s.id !== shiftId))
    } catch (err) {
      console.error('Errore rimozione turno:', err)
      setErrorMsg('Errore durante la rimozione del turno.')
    } finally {
      setRemoving(null)
    }
  }

  /* ---- Month/year picker options ---- */
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i, label: MONTH_NAMES[i] }))
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  const Spinner = () => (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

      {/* Error */}
      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
          <Spinner />
          Caricamento turni...
        </div>
      ) : shifts.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          Nessun turno per {MONTH_NAMES[filterMonth]} {filterYear}.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm" aria-label={`Lista turni ${MONTH_NAMES[filterMonth]} ${filterYear}`}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th scope="col" className="text-left py-2.5 px-4 sm:px-0 font-semibold text-gray-500 text-xs uppercase tracking-wide">Data</th>
                  <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Giorno</th>
                  <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Dipendente</th>
                  <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tipo</th>
                  <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Assegnato da</th>
                  {!locked && (
                    <th scope="col" className="py-2.5 px-4 sm:px-2 text-xs uppercase tracking-wide">
                      <span className="sr-only">Azioni</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 sm:px-0 text-gray-700 whitespace-nowrap">{formatDate(shift.date)}</td>
                    <td className="py-2.5 px-4 sm:px-2 text-gray-500 whitespace-nowrap">{getDayName(shift.date)}</td>
                    <td className="py-2.5 px-4 sm:px-2 font-medium text-gray-800">{shift.userName}</td>
                    <td className="py-2.5 px-4 sm:px-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SHIFT_TYPE_STYLES[shift.shift_type]}`}>
                        {SHIFT_TYPE_LABELS[shift.shift_type]}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 sm:px-2 text-gray-500 hidden sm:table-cell">{shift.createdByName}</td>
                    {!locked && (
                      <td className="py-2.5 px-4 sm:px-2 text-right">
                        {removing === shift.id ? (
                          <span className="text-gray-400"><Spinner /></span>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(shift.id)}
                            className="text-xs text-red-500 hover:text-red-700 hover:underline focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
                            aria-label={`Rimuovi turno di ${shift.userName} del ${shift.date}`}
                          >
                            Rimuovi
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <p className="mt-4 text-sm text-gray-500 text-right">
            Totale turni: <strong className="text-gray-800">{shifts.length}</strong>
          </p>
        </>
      )}

      {/* Confirm remove dialog */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Conferma rimozione turno"
        >
          <div className="absolute inset-0 bg-black/20" onClick={() => setConfirmRemove(null)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-5 max-w-sm w-full z-10">
            <p className="text-sm text-gray-700 mb-4">
              Sei sicuro di voler rimuovere questo turno? L&apos;operazione non può essere annullata.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRemove(confirmRemove)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Rimuovi
              </button>
              <button
                onClick={() => setConfirmRemove(null)}
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
