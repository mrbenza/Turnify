'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Availability, Shift, Holiday, ShiftType } from '@/lib/supabase/types'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CalendarioGlobaleProps {
  initialUsers: User[]
  initialAvailability: Availability[]
  initialShifts: Shift[]
  initialHolidays: Holiday[]
  initialMonth: number
  initialYear: number
  initialLocked: boolean
  adminId: string
}

type CellStatus = 'available' | 'unavailable' | 'shift' | 'approved' | 'empty'

interface Popover {
  userId: string
  dateStr: string
  userName: string
  action: 'assign' | 'remove'
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

function getDayOfWeekLabel(year: number, month: number, day: number): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  return days[new Date(year, month, day).getDay()]
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CalendarioGlobale({
  initialUsers,
  initialAvailability,
  initialShifts,
  initialHolidays,
  initialMonth,
  initialYear,
  initialLocked,
  adminId,
}: CalendarioGlobaleProps) {
  const [viewMonth, setViewMonth] = useState(initialMonth)
  const [viewYear, setViewYear] = useState(initialYear)
  const [availability, setAvailability] = useState<Availability[]>(initialAvailability)
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
  const [users] = useState<User[]>(initialUsers)
  const [locked, setLocked] = useState(initialLocked)
  const [popover, setPopover] = useState<Popover | null>(null)
  const [loadingCell, setLoadingCell] = useState<string | null>(null) // `${userId}-${dateStr}`
  const [lockingMonth, setLockingMonth] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingMonth, setLoadingMonth] = useState(false)

  /* ---- Computed maps (memoised to avoid re-creation on every render) ---- */
  const availabilityMap = useMemo(() => {
    const m = new Map<string, Availability>()
    availability.forEach((a) => m.set(`${a.user_id}-${a.date}`, a))
    return m
  }, [availability])

  const shiftMap = useMemo(() => {
    const m = new Map<string, Shift>()
    shifts.forEach((s) => m.set(`${s.user_id}-${s.date}`, s))
    return m
  }, [shifts])

  const holidaySet = useMemo(
    () => new Set<string>(holidays.map((h) => h.date)),
    [holidays]
  )

  /* ---- Days of month that are visible (Sat / Sun / Holidays) ---- */
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const visibleDays: number[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateString(viewYear, viewMonth, d)
    if (isWeekend(viewYear, viewMonth, d) || holidaySet.has(dateStr)) {
      visibleDays.push(d)
    }
  }

  /* ---- Navigation with data reload ---- */
  async function navigate(direction: 'prev' | 'next') {
    let newMonth = viewMonth + (direction === 'next' ? 1 : -1)
    let newYear = viewYear
    if (newMonth > 11) { newMonth = 0; newYear++ }
    if (newMonth < 0) { newMonth = 11; newYear-- }

    setViewMonth(newMonth)
    setViewYear(newYear)
    setLoadingMonth(true)
    setErrorMsg(null)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const from = toDateString(newYear, newMonth, 1)
      const to = toDateString(newYear, newMonth, new Date(newYear, newMonth + 1, 0).getDate())

      const [availRes, shiftsRes, holRes, statusRes] = await Promise.all([
        supabase.from('availability').select('*').gte('date', from).lte('date', to),
        supabase.from('shifts').select('*').gte('date', from).lte('date', to),
        supabase.from('holidays').select('*').gte('date', from).lte('date', to),
        supabase.from('month_status').select('*').eq('month', newMonth + 1).eq('year', newYear).single(),
      ])

      setAvailability((availRes.data as Availability[]) ?? [])
      setShifts((shiftsRes.data as Shift[]) ?? [])
      setHolidays((holRes.data as Holiday[]) ?? [])
      setLocked(statusRes.data?.status === 'locked')
    } catch (err) {
      console.error('Errore navigazione mese:', err)
      setErrorMsg('Impossibile caricare i dati del mese.')
    } finally {
      setLoadingMonth(false)
    }
  }

  /* ---- Cell status ---- */
  function getCellStatus(userId: string, dateStr: string): CellStatus {
    if (shiftMap.has(`${userId}-${dateStr}`)) return 'shift'
    const avail = availabilityMap.get(`${userId}-${dateStr}`)
    if (!avail) return 'empty'
    if (avail.status === 'approved') return 'approved'
    if (avail.available) return 'available'
    return 'unavailable'
  }

  /* ---- Cell click ---- */
  function handleCellClick(userId: string, dateStr: string, userName: string) {
    if (locked) return
    const status = getCellStatus(userId, dateStr)
    if (status === 'unavailable' || status === 'empty') return

    if (status === 'shift') {
      setPopover({ userId, dateStr, userName, action: 'remove' })
    } else if (status === 'available' || status === 'approved') {
      setPopover({ userId, dateStr, userName, action: 'assign' })
    }
  }

  /* ---- Assign shift ---- */
  const handleAssign = useCallback(async () => {
    if (!popover) return
    const { userId, dateStr } = popover
    const cellKey = `${userId}-${dateStr}`
    setPopover(null)
    setLoadingCell(cellKey)
    setErrorMsg(null)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const [year, month, day] = dateStr.split('-').map(Number)
      const isHol = holidaySet.has(dateStr)
      const isWknd = isWeekend(year, month - 1, day)
      const shiftType: ShiftType = isHol ? 'festivo' : isWknd ? 'weekend' : 'reperibilita'

      const { data, error } = await supabase
        .from('shifts')
        .insert({ date: dateStr, user_id: userId, shift_type: shiftType, created_by: adminId })
        .select()
        .single()

      if (error) throw error
      setShifts((prev) => [...prev, data as Shift])
    } catch (err) {
      console.error('Errore assegnazione turno:', err)
      setErrorMsg('Errore durante l\'assegnazione del turno.')
    } finally {
      setLoadingCell(null)
    }
  }, [popover, holidaySet, adminId])

  /* ---- Remove shift ---- */
  const handleRemove = useCallback(async () => {
    if (!popover) return
    const { userId, dateStr } = popover
    const cellKey = `${userId}-${dateStr}`
    setPopover(null)
    setLoadingCell(cellKey)
    setErrorMsg(null)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const shift = shiftMap.get(`${userId}-${dateStr}`)
      if (!shift) return

      const { error } = await supabase.from('shifts').delete().eq('id', shift.id)
      if (error) throw error
      setShifts((prev) => prev.filter((s) => s.id !== shift.id))
    } catch (err) {
      console.error('Errore rimozione turno:', err)
      setErrorMsg('Errore durante la rimozione del turno.')
    } finally {
      setLoadingCell(null)
    }
  }, [popover, shiftMap])

  /* ---- Lock month ---- */
  async function handleLockMonth() {
    setLockingMonth(true)
    setErrorMsg(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any

      // Check if month_status row exists
      const { data: existing } = await supabase
        .from('month_status')
        .select('id')
        .eq('month', viewMonth + 1)
        .eq('year', viewYear)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('month_status')
          .update({ status: 'locked', locked_by: adminId, locked_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('month_status')
          .insert({ month: viewMonth + 1, year: viewYear, status: 'locked', locked_by: adminId, locked_at: new Date().toISOString() })
        if (error) throw error
      }

      setLocked(true)
    } catch (err) {
      console.error('Errore conferma mese:', err)
      setErrorMsg('Errore durante la conferma del mese.')
    } finally {
      setLockingMonth(false)
    }
  }

  /* ---- Cell style ---- */
  function cellClasses(status: CellStatus, clickable: boolean, isLoading: boolean): string {
    const base = 'relative flex items-center justify-center rounded text-xs font-medium h-9 w-full transition-all select-none'
    const loadingClass = isLoading ? 'opacity-50 cursor-wait' : ''

    const map: Record<CellStatus, string> = {
      available: `${base} bg-green-100 border border-green-300 text-green-800 ${clickable && !isLoading ? 'cursor-pointer hover:bg-green-200' : 'cursor-default'}`,
      approved: `${base} bg-yellow-50 border border-yellow-300 text-yellow-800 ${clickable && !isLoading ? 'cursor-pointer hover:bg-yellow-100' : 'cursor-default'}`,
      shift: `${base} bg-red-100 border border-red-300 text-red-800 ${clickable && !isLoading ? 'cursor-pointer hover:bg-red-200' : 'cursor-default'}`,
      unavailable: `${base} bg-gray-100 border border-gray-200 text-gray-400 cursor-default`,
      empty: `${base} bg-gray-50 border border-gray-100 text-gray-300 cursor-default`,
    }

    return `${map[status]} ${loadingClass}`.trim()
  }

  const Spinner = () => (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div>
      {/* Header row: month navigation + lock button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('prev')}
            disabled={loadingMonth}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Mese precedente"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 className="text-base font-semibold text-gray-900 min-w-[160px] text-center">
            {loadingMonth ? (
              <span className="text-gray-400">Caricamento...</span>
            ) : (
              `${MONTH_NAMES[viewMonth]} ${viewYear}`
            )}
          </h2>

          <button
            onClick={() => navigate('next')}
            disabled={loadingMonth}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Mese successivo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Lock / locked badge */}
        {locked ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Mese confermato
          </span>
        ) : (
          <button
            onClick={handleLockMonth}
            disabled={lockingMonth}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Conferma e blocca il mese corrente"
          >
            {lockingMonth ? <Spinner /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            Conferma mese
          </button>
        )}
      </div>

      {/* Error message */}
      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-gray-600" aria-label="Legenda colori">
        <LegendItem color="bg-green-100 border border-green-300" label="Disponibile" />
        <LegendItem color="bg-yellow-50 border border-yellow-300" label="Approvato" />
        <LegendItem color="bg-red-100 border border-red-300" label="Turno assegnato" />
        <LegendItem color="bg-gray-100 border border-gray-200" label="Non disponibile" />
        <LegendItem color="bg-gray-50 border border-gray-100" label="Nessuna risposta" />
      </div>

      {/* Empty state: no visible days */}
      {visibleDays.length === 0 && !loadingMonth && (
        <p className="text-sm text-gray-500 py-8 text-center">
          Nessun sabato, domenica o festività in questo mese.
        </p>
      )}

      {/* Grid: scrollable table */}
      {visibleDays.length > 0 && !loadingMonth && (
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          <table className="min-w-full text-sm" aria-label={`Calendario disponibilità ${MONTH_NAMES[viewMonth]} ${viewYear}`}>
            <thead>
              <tr>
                {/* Dipendente column header */}
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-white text-left py-2 pr-3 pl-0 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap min-w-[120px]"
                >
                  Dipendente
                </th>
                {/* Day column headers */}
                {visibleDays.map((day) => {
                  const dateStr = toDateString(viewYear, viewMonth, day)
                  const isHol = holidaySet.has(dateStr)
                  const dowLabel = getDayOfWeekLabel(viewYear, viewMonth, day)
                  return (
                    <th
                      key={day}
                      scope="col"
                      className="py-2 px-1 text-center font-semibold text-gray-500 text-xs min-w-[52px]"
                    >
                      <div className={`${isHol ? 'text-orange-500' : 'text-gray-400'}`}>{dowLabel}</div>
                      <div className={`text-sm font-bold ${isHol ? 'text-orange-600' : 'text-gray-700'}`}>{day}</div>
                      {isHol && (
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mx-auto mt-0.5" aria-hidden="true" />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  {/* User name */}
                  <td className="sticky left-0 z-10 bg-white py-2 pr-3 pl-0 font-medium text-gray-700 whitespace-nowrap text-xs">
                    {user.nome}
                  </td>
                  {/* Day cells */}
                  {visibleDays.map((day) => {
                    const dateStr = toDateString(viewYear, viewMonth, day)
                    const status = getCellStatus(user.id, dateStr)
                    const cellKey = `${user.id}-${dateStr}`
                    const isLoading = loadingCell === cellKey
                    const clickable = !locked && (status === 'available' || status === 'approved' || status === 'shift')

                    return (
                      <td key={day} className="py-1.5 px-1">
                        <div
                          role={clickable ? 'button' : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          aria-label={`${user.nome} — ${day} ${MONTH_NAMES[viewMonth]}: ${status}`}
                          className={cellClasses(status, clickable, isLoading)}
                          onClick={() => handleCellClick(user.id, dateStr, user.nome)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleCellClick(user.id, dateStr, user.nome)
                            }
                          }}
                        >
                          {isLoading ? <Spinner /> : cellLabel(status)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Popover confirmation */}
      {popover && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={popover.action === 'assign' ? 'Conferma assegnazione turno' : 'Conferma rimozione turno'}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setPopover(null)}
            aria-hidden="true"
          />
          {/* Card */}
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-5 max-w-sm w-full z-10">
            <p className="text-sm text-gray-700 mb-1">
              {popover.action === 'assign' ? (
                <>
                  Assegna turno a <strong>{popover.userName}</strong>?
                </>
              ) : (
                <>
                  Rimuovi il turno di <strong>{popover.userName}</strong>?
                </>
              )}
            </p>
            <p className="text-xs text-gray-400 mb-4">{popover.dateStr}</p>
            <div className="flex gap-2">
              <button
                onClick={popover.action === 'assign' ? handleAssign : handleRemove}
                className={`flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 ${
                  popover.action === 'assign'
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-400'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-400'
                }`}
              >
                {popover.action === 'assign' ? 'Assegna' : 'Rimuovi'}
              </button>
              <button
                onClick={() => setPopover(null)}
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

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function cellLabel(status: CellStatus): string {
  switch (status) {
    case 'available': return 'Disp.'
    case 'approved': return 'Appr.'
    case 'shift': return 'Turno'
    case 'unavailable': return 'No'
    case 'empty': return '—'
  }
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-4 h-4 rounded ${color} inline-block shrink-0`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
