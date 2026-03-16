'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Availability, Shift, Holiday, ShiftType } from '@/lib/supabase/types'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CalendarioGlobaleProps {
  initialUsers: User[]
  initialAvailability: Availability[]
  initialShifts: Shift[]
  initialHolidays: Holiday[]
  initialMonth: number   // 0-indexed
  initialYear: number
  initialLocked: boolean
  adminId: string
}

/** Selected day for the side drawer */
interface SelectedDay {
  day: number
  dateStr: string
  isWeekend: boolean
  holiday: Holiday | null
}

/** Pending action to confirm (assign or remove) */
interface PendingAction {
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

/**
 * Returns the ISO weekday index (0=Mon … 6=Sun) for a given date.
 * JS Date.getDay() returns 0=Sun..6=Sat, so we remap.
 */
function isoWeekday(year: number, month: number, day: number): number {
  const dow = new Date(year, month, day).getDay() // 0=Sun
  return dow === 0 ? 6 : dow - 1 // 0=Mon … 6=Sun
}

function isWeekendDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

function formatFullDate(day: number, month: number, year: number): string {
  const dowNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  const dow = new Date(year, month, day).getDay()
  return `${dowNames[dow]} ${day} ${MONTH_NAMES[month]} ${year}`
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

const Spinner = ({ small = false }: { small?: boolean }) => (
  <svg
    className={`${small ? 'w-3 h-3' : 'w-4 h-4'} animate-spin shrink-0`}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
)

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
  /* ---- Core state ---- */
  const [viewMonth, setViewMonth] = useState(initialMonth)
  const [viewYear, setViewYear] = useState(initialYear)
  const [availability, setAvailability] = useState<Availability[]>(initialAvailability)
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
  const [users] = useState<User[]>(initialUsers)
  const [locked, setLocked] = useState(initialLocked)

  /* ---- UI state ---- */
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null) // `${userId}-${dateStr}`
  const [lockingMonth, setLockingMonth] = useState(false)
  const [unlockingMonth, setUnlockingMonth] = useState(false)
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /* ---- Drawer ref for focus trap ---- */
  const drawerRef = useRef<HTMLDivElement>(null)

  /* ---- Close drawer on Escape ---- */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pendingAction) { setPendingAction(null); return }
        if (showUnlockDialog) { setShowUnlockDialog(false); return }
        setSelectedDay(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [pendingAction, showUnlockDialog])

  /* ---- Computed maps ---- */
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

  const holidayMap = useMemo(() => {
    const m = new Map<string, Holiday>()
    holidays.forEach((h) => m.set(h.date, h))
    return m
  }, [holidays])

  /* ---- Calendar grid cells ---- */
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  /**
   * Build the grid: an array of 42 cells (6 rows × 7 cols).
   * null means an empty padding cell.
   */
  const calendarCells = useMemo(() => {
    const firstDow = isoWeekday(viewYear, viewMonth, 1) // 0=Mon … 6=Sun
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    // pad to a multiple of 7
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewYear, viewMonth, daysInMonth])

  /* ---- Validation: uncovered weekends/holidays ---- */
  function getUncoveredDays(): string[] {
    const uncovered: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateString(viewYear, viewMonth, d)
      const isWknd = isWeekendDay(viewYear, viewMonth, d)
      const isHol = holidayMap.has(dateStr)
      if (!isWknd && !isHol) continue
      // check at least one shift on this date
      const hasShift = shifts.some((s) => s.date === dateStr)
      if (!hasShift) {
        const dow = new Date(viewYear, viewMonth, d).getDay()
        const dowLabel = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][dow]
        uncovered.push(`${dowLabel} ${d}/${viewMonth + 1}`)
      }
    }
    return uncovered
  }

  /* ---- Navigation ---- */
  async function navigate(direction: 'prev' | 'next') {
    let newMonth = viewMonth + (direction === 'next' ? 1 : -1)
    let newYear = viewYear
    if (newMonth > 11) { newMonth = 0; newYear++ }
    if (newMonth < 0) { newMonth = 11; newYear-- }

    setSelectedDay(null)
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
        supabase.from('month_status').select('*').eq('month', newMonth + 1).eq('year', newYear).maybeSingle(),
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

  /* ---- Lock month ---- */
  async function handleLockMonth() {
    setErrorMsg(null)
    const uncovered = getUncoveredDays()
    if (uncovered.length > 0) {
      setErrorMsg(`Giorni senza turno assegnato: ${uncovered.join(', ')}`)
      return
    }

    setLockingMonth(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const { error } = await supabase
        .from('month_status')
        .upsert(
          {
            month: viewMonth + 1,
            year: viewYear,
            status: 'locked',
            locked_by: adminId,
            locked_at: new Date().toISOString(),
          },
          { onConflict: 'month,year' }
        )
      if (error) throw error
      setLocked(true)
    } catch (err) {
      console.error('Errore conferma mese:', err)
      setErrorMsg('Errore durante la conferma del mese.')
    } finally {
      setLockingMonth(false)
    }
  }

  /* ---- Unlock month ---- */
  async function handleUnlockMonth() {
    setShowUnlockDialog(false)
    setUnlockingMonth(true)
    setErrorMsg(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const { error } = await supabase
        .from('month_status')
        .upsert(
          {
            month: viewMonth + 1,
            year: viewYear,
            status: 'open',
            locked_by: null,
            locked_at: null,
          },
          { onConflict: 'month,year' }
        )
      if (error) throw error
      setLocked(false)
    } catch (err) {
      console.error('Errore annulla conferma:', err)
      setErrorMsg('Errore durante l\'annullamento della conferma.')
    } finally {
      setUnlockingMonth(false)
    }
  }

  /* ---- Assign shift ---- */
  const handleAssign = useCallback(async () => {
    if (!pendingAction) return
    const { userId, dateStr } = pendingAction
    const cellKey = `${userId}-${dateStr}`
    setPendingAction(null)
    setLoadingAction(cellKey)
    setErrorMsg(null)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const [year, month, day] = dateStr.split('-').map(Number)
      const isHol = holidayMap.has(dateStr)
      const isWknd = isWeekendDay(year, month - 1, day)
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
      setLoadingAction(null)
    }
  }, [pendingAction, holidayMap, adminId])

  /* ---- Remove shift ---- */
  const handleRemove = useCallback(async () => {
    if (!pendingAction) return
    const { userId, dateStr } = pendingAction
    const cellKey = `${userId}-${dateStr}`
    setPendingAction(null)
    setLoadingAction(cellKey)
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
      setLoadingAction(null)
    }
  }, [pendingAction, shiftMap])

  /* ---- User chip status for a given date ---- */
  function getUserChipStatus(userId: string, dateStr: string): 'shift' | 'available' | 'unavailable' {
    if (shiftMap.has(`${userId}-${dateStr}`)) return 'shift'
    const avail = availabilityMap.get(`${userId}-${dateStr}`)
    if (avail && avail.available) return 'available'
    return 'unavailable'
  }

  /* ---- Render calendar cell ---- */
  function renderCell(day: number) {
    const dateStr = toDateString(viewYear, viewMonth, day)
    const isWknd = isWeekendDay(viewYear, viewMonth, day)
    const holiday = holidayMap.get(dateStr) ?? null
    const interactive = isWknd || holiday !== null
    const isSelected = selectedDay?.dateStr === dateStr

    const hasShift = shifts.some((s) => s.date === dateStr)
    const hasUncoveredWarning = !locked && !hasShift && interactive

    // Background color logic
    let bgClass = 'bg-white'
    if (isWknd && !holiday) bgClass = 'bg-indigo-50'
    if (holiday) bgClass = 'bg-orange-50'

    // Border logic
    let borderClass = 'border border-gray-100'
    if (holiday) borderClass = 'border border-orange-300'
    if (isSelected) borderClass = 'border-2 border-blue-500'

    // Cursor
    const cursorClass = interactive ? 'cursor-pointer hover:brightness-95 active:brightness-90' : 'cursor-default'

    return (
      <div
        key={day}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? `${formatFullDate(day, viewMonth, viewYear)}${holiday ? ` — ${holiday.name}` : ''}`
            : undefined
        }
        aria-pressed={interactive ? isSelected : undefined}
        onClick={() => {
          if (!interactive) return
          setSelectedDay({ day, dateStr, isWeekend: isWknd, holiday })
        }}
        onKeyDown={(e) => {
          if (!interactive) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setSelectedDay({ day, dateStr, isWeekend: isWknd, holiday })
          }
        }}
        className={`
          relative min-h-[80px] sm:min-h-[100px] p-1.5 rounded-lg transition-all
          ${bgClass} ${borderClass} ${cursorClass}
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
        `}
      >
        {/* Day number */}
        <span
          className={`
            text-xs font-bold leading-none
            ${isWknd || holiday ? 'text-indigo-700' : 'text-gray-400'}
            ${holiday ? 'text-orange-700' : ''}
          `}
        >
          {day}
        </span>

        {/* Holiday name */}
        {holiday && (
          <p className="text-[9px] leading-tight text-orange-600 mt-0.5 font-medium line-clamp-2">
            {holiday.name}
          </p>
        )}

        {/* Shift confirmed badge */}
        {interactive && hasShift && (
          <span
            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
            aria-label="Turno assegnato"
            title="Turno assegnato"
          >
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
            </svg>
          </span>
        )}

        {/* Warning badge (no shift yet, not locked) */}
        {hasUncoveredWarning && (
          <span
            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center"
            aria-label="Nessun turno assegnato"
            title="Nessun turno assegnato"
          >
            <span className="text-white text-[9px] font-bold leading-none">!</span>
          </span>
        )}

        {/* User chips — only for interactive days */}
        {interactive && (
          <div className="mt-1 flex flex-wrap gap-0.5">
            {users.slice(0, 4).map((u) => {
              const chipStatus = getUserChipStatus(u.id, dateStr)
              const chipColor =
                chipStatus === 'shift'
                  ? 'bg-red-400 text-white'
                  : chipStatus === 'available'
                  ? 'bg-green-400 text-white'
                  : 'bg-gray-200 text-gray-500'
              return (
                <span
                  key={u.id}
                  className={`inline-block rounded px-1 py-0.5 text-[8px] leading-none font-medium truncate max-w-[36px] ${chipColor}`}
                  title={`${u.nome}: ${chipStatus === 'shift' ? 'Turno' : chipStatus === 'available' ? 'Disponibile' : 'Non disp.'}`}
                  aria-hidden="true"
                >
                  {u.nome.split(' ')[0]}
                </span>
              )
            })}
            {users.length > 4 && (
              <span className="inline-block rounded px-1 py-0.5 text-[8px] leading-none bg-gray-100 text-gray-400" aria-hidden="true">
                +{users.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="relative">

      {/* ---- Header: navigation + lock controls ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">

        {/* Month navigation */}
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

          <h2 className="text-base font-semibold text-gray-900 min-w-[170px] text-center select-none">
            {loadingMonth ? (
              <span className="text-gray-400 text-sm">Caricamento...</span>
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

        {/* Lock / unlock controls */}
        <div className="flex items-center gap-2">
          {locked ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium select-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Mese confermato
              </span>
              <button
                onClick={() => setShowUnlockDialog(true)}
                disabled={unlockingMonth}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                aria-label="Annulla conferma del mese"
              >
                {unlockingMonth ? <Spinner small /> : null}
                Annulla conferma
              </button>
            </>
          ) : (
            <button
              onClick={handleLockMonth}
              disabled={lockingMonth || loadingMonth}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Conferma e blocca il mese corrente"
            >
              {lockingMonth ? (
                <Spinner small />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              Conferma mese
            </button>
          )}
        </div>
      </div>

      {/* ---- Error message ---- */}
      {errorMsg && (
        <div
          className="mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
          role="alert"
          aria-live="assertive"
        >
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
          </svg>
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="ml-auto text-red-400 hover:text-red-600 shrink-0 focus:outline-none focus:ring-1 focus:ring-red-400 rounded"
            aria-label="Chiudi messaggio di errore"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ---- Legend ---- */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500" aria-label="Legenda">
        <LegendChip color="bg-green-400" label="Disponibile" />
        <LegendChip color="bg-red-400" label="Turno assegnato" />
        <LegendChip color="bg-gray-200" label="Non disponibile / nessuna risposta" />
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center shrink-0" aria-hidden="true">
            <svg className="w-2 h-2 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
          </span>
          Turno assegnato (badge)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center shrink-0 text-white text-[8px] font-bold" aria-hidden="true">!</span>
          Nessun turno ancora
        </span>
      </div>

      {/* ---- Calendar grid ---- */}
      {loadingMonth ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Spinner />
          <span className="ml-2 text-sm">Caricamento calendario...</span>
        </div>
      ) : (
        <div
          className="grid grid-cols-7 gap-1"
          role="grid"
          aria-label={`Calendario ${MONTH_NAMES[viewMonth]} ${viewYear}`}
        >
          {/* Day-of-week header row */}
          {DAY_LABELS.map((label, i) => (
            <div
              key={label}
              role="columnheader"
              className={`
                text-center text-[10px] sm:text-xs font-semibold py-1.5 uppercase tracking-wide select-none
                ${i >= 5 ? 'text-indigo-500' : 'text-gray-400'}
              `}
            >
              {label}
            </div>
          ))}

          {/* Calendar cells */}
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  role="gridcell"
                  aria-hidden="true"
                  className="min-h-[80px] sm:min-h-[100px] rounded-lg bg-gray-50/40"
                />
              )
            }
            return (
              <div key={day} role="gridcell">
                {renderCell(day)}
              </div>
            )
          })}
        </div>
      )}

      {/* ================================================================ */}
      {/* Side Drawer (desktop) / Bottom Sheet (mobile)                    */}
      {/* ================================================================ */}
      {selectedDay && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedDay(null)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Dettaglio ${formatFullDate(selectedDay.day, viewMonth, viewYear)}`}
            className={`
              fixed z-50 bg-white shadow-2xl flex flex-col
              /* Mobile: bottom sheet */
              bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]
              /* Desktop: right drawer */
              sm:bottom-0 sm:top-0 sm:left-auto sm:right-0 sm:w-80 sm:rounded-none sm:max-h-none sm:h-full
            `}
          >
            {/* Drawer header */}
            <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {formatFullDate(selectedDay.day, viewMonth, viewYear)}
                </h3>
                {selectedDay.holiday && (
                  <p className="text-xs text-orange-600 mt-0.5 font-medium">{selectedDay.holiday.name}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Chiudi pannello"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-2 pb-1 -mt-2 absolute top-0 left-0 right-0" aria-hidden="true">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {users.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nessun dipendente attivo.</p>
              )}

              <ul className="space-y-2" aria-label="Elenco dipendenti">
                {users.map((user) => {
                  const chipStatus = getUserChipStatus(user.id, selectedDay.dateStr)
                  const isLoadingThis = loadingAction === `${user.id}-${selectedDay.dateStr}`

                  return (
                    <li
                      key={user.id}
                      className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      {/* User info + status */}
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={chipStatus} />
                        <span className="text-sm font-medium text-gray-800 truncate">{user.nome}</span>
                        <span className={`text-xs shrink-0 ${chipStatus === 'shift' ? 'text-red-600' : chipStatus === 'available' ? 'text-green-600' : 'text-gray-400'}`}>
                          {chipStatus === 'shift' ? 'Turno' : chipStatus === 'available' ? 'Disponibile' : 'Non disp.'}
                        </span>
                      </div>

                      {/* Action button */}
                      {!locked && (
                        <div className="shrink-0">
                          {isLoadingThis ? (
                            <Spinner small />
                          ) : chipStatus === 'shift' ? (
                            <button
                              onClick={() => setPendingAction({ userId: user.id, dateStr: selectedDay.dateStr, userName: user.nome, action: 'remove' })}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                              aria-label={`Rimuovi turno di ${user.nome}`}
                            >
                              Rimuovi
                            </button>
                          ) : chipStatus === 'available' ? (
                            <button
                              onClick={() => setPendingAction({ userId: user.id, dateStr: selectedDay.dateStr, userName: user.nome, action: 'assign' })}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400"
                              aria-label={`Assegna turno a ${user.nome}`}
                            >
                              Assegna
                            </button>
                          ) : null}
                        </div>
                      )}

                      {/* Locked state indicator */}
                      {locked && chipStatus === 'shift' && (
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-label="Turno confermato">
                          <title>Turno confermato</title>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* Confirmation dialog: assign / remove                             */}
      {/* ================================================================ */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={pendingAction.action === 'assign' ? 'Conferma assegnazione turno' : 'Conferma rimozione turno'}
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setPendingAction(null)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 max-w-sm w-full z-10">
            <p className="text-sm text-gray-700 mb-1">
              {pendingAction.action === 'assign' ? (
                <>Assegna turno a <strong>{pendingAction.userName}</strong>?</>
              ) : (
                <>Rimuovi il turno di <strong>{pendingAction.userName}</strong>?</>
              )}
            </p>
            <p className="text-xs text-gray-400 mb-4">{pendingAction.dateStr}</p>
            <div className="flex gap-2">
              <button
                onClick={pendingAction.action === 'assign' ? handleAssign : handleRemove}
                className={`flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 ${
                  pendingAction.action === 'assign'
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-400'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-400'
                }`}
              >
                {pendingAction.action === 'assign' ? 'Assegna' : 'Rimuovi'}
              </button>
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Unlock confirmation dialog                                       */}
      {/* ================================================================ */}
      {showUnlockDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Conferma annullamento mese"
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowUnlockDialog(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 max-w-sm w-full z-10">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
              </svg>
              <h4 className="text-sm font-semibold text-gray-900">Annulla conferma mese?</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Sei sicuro? Il mese tornerà modificabile e potranno essere apportate nuove modifiche.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleUnlockMonth}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Sì, annulla conferma
              </button>
              <button
                onClick={() => setShowUnlockDialog(false)}
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
/* Small sub-components                                                */
/* ------------------------------------------------------------------ */

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${color} inline-block shrink-0`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

function StatusDot({ status }: { status: 'shift' | 'available' | 'unavailable' }) {
  const color =
    status === 'shift' ? 'bg-red-400' : status === 'available' ? 'bg-green-400' : 'bg-gray-300'
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} aria-hidden="true" />
}
