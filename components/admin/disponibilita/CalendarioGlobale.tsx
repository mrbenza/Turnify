'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Availability, Shift, Holiday } from '@/lib/supabase/types'

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
}: CalendarioGlobaleProps) {
  /* ---- Core state ---- */
  const [viewMonth, setViewMonth] = useState(initialMonth)
  const [viewYear, setViewYear] = useState(initialYear)
  const [availability, setAvailability] = useState<Availability[]>(initialAvailability)
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
  const [users] = useState<User[]>(initialUsers)
  const [locked, setLocked] = useState(initialLocked)
  const [prevMonthShifts, setPrevMonthShifts] = useState<Shift[]>([])
  const [equityScores, setEquityScores] = useState<Map<string, number>>(new Map())

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

  /* ---- Fetch turni mese precedente + equity scores ---- */
  async function fetchAuxData(month: number, year: number) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      const prevFrom = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`
      const prevTo = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(new Date(prevYear, prevMonth + 1, 0).getDate()).padStart(2, '0')}`

      const [prevRes, equityRes] = await Promise.all([
        supabase.from('shifts').select('user_id, date, shift_type').gte('date', prevFrom).lte('date', prevTo),
        supabase.rpc('get_equity_scores', { p_month: 0, p_year: year }),
      ])

      setPrevMonthShifts((prevRes.data as Shift[]) ?? [])
      const scoreMap = new Map<string, number>()
      for (const row of equityRes.data ?? []) {
        scoreMap.set(row.user_id, row.score ?? 0)
      }
      setEquityScores(scoreMap)
    } catch (err) {
      console.error('Errore fetch dati aux:', err)
    }
  }

  useEffect(() => {
    fetchAuxData(viewMonth, viewYear)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      fetchAuxData(newMonth, newYear)
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
      const res = await fetch('/api/month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: viewMonth + 1, year: viewYear, action: 'lock' }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
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
      const res = await fetch('/api/month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: viewMonth + 1, year: viewYear, action: 'unlock' }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
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
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, user_id: userId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      const data = await res.json() as Shift
      setShifts((prev) => [...prev, data])
    } catch (err) {
      console.error('Errore assegnazione turno:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante l\'assegnazione del turno.')
    } finally {
      setLoadingAction(null)
    }
  }, [pendingAction])

  /* ---- Remove shift ---- */
  const handleRemove = useCallback(async () => {
    if (!pendingAction) return
    const { userId, dateStr } = pendingAction
    const cellKey = `${userId}-${dateStr}`
    setPendingAction(null)
    setLoadingAction(cellKey)
    setErrorMsg(null)

    try {
      const shift = shiftMap.get(`${userId}-${dateStr}`)
      if (!shift) return

      const res = await fetch(`/api/shifts/${shift.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      setShifts((prev) => prev.filter((s) => s.id !== shift.id))
    } catch (err) {
      console.error('Errore rimozione turno:', err)
      setErrorMsg('Errore durante la rimozione del turno.')
    } finally {
      setLoadingAction(null)
    }
  }, [pendingAction, shiftMap])

  /* ---- Weekend conflict check ---- */
  // Restituisce true se l'utente ha già un turno weekend in un ALTRO weekend dello stesso mese
  function isWeekendBlocked(userId: string, dateStr: string): boolean {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) return false // giorno feriale → nessun blocco
    const satDay = dow === 6 ? d : d - 1
    const satStr = `${y}-${String(m).padStart(2, '0')}-${String(satDay).padStart(2, '0')}`
    const sunStr = `${y}-${String(m).padStart(2, '0')}-${String(satDay + 1).padStart(2, '0')}`
    const monthPrefix = `${y}-${String(m).padStart(2, '0')}`
    return shifts.some(
      (s) =>
        s.user_id === userId &&
        (s.shift_type === 'weekend' || s.shift_type === 'festivo') &&
        s.date.startsWith(monthPrefix) &&
        s.date !== satStr &&
        s.date !== sunStr
    )
  }

  /* ---- Suggerimenti 2° reperibile ---- */

  // Restituisce sat/sun del weekend PRECEDENTE a quello della data
  function getPrevWeekend(dateStr: string): { sat: string; sun: string } {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
    const currSat = dow === 6 ? d : d - 1
    const prevSat = new Date(Date.UTC(y, m - 1, currSat - 7))
    const prevSun = new Date(Date.UTC(y, m - 1, currSat - 6))
    const fmt = (dt: Date) => dt.toISOString().split('T')[0]
    return { sat: fmt(prevSat), sun: fmt(prevSun) }
  }

  function workedPrevMonth(userId: string): boolean {
    return prevMonthShifts.some((s) => s.user_id === userId)
  }

  function workedPrevWeekend(userId: string, dateStr: string): boolean {
    const { sat, sun } = getPrevWeekend(dateStr)
    const allShifts = [...shifts, ...prevMonthShifts]
    return allShifts.some((s) => s.user_id === userId && (s.date === sat || s.date === sun))
  }

  // Livello di raccomandazione per il 2° slot (quando c'è già 1 assegnato)
  // 'ideal'   → non ha lavorato il mese prec. E non ha lavorato il w.e. prec.
  // 'warning' → ha lavorato il mese prec. O il w.e. prec. (ma non entrambi)
  // 'avoid'   → ha lavorato sia il mese prec. che il w.e. prec.
  // 'neutral' → nessuna info rilevante (primo slot vuoto)
  function getRecommendationLevel(userId: string, dateStr: string): 'ideal' | 'warning' | 'avoid' | 'neutral' {
    const hasShiftOnDay = shiftMap.has(`${userId}-${dateStr}`)
    if (hasShiftOnDay) return 'neutral'
    const prevMonth = workedPrevMonth(userId)
    const prevWe = workedPrevWeekend(userId, dateStr)
    if (!prevMonth && !prevWe) return 'ideal'
    if (prevMonth && prevWe) return 'avoid'
    return 'warning'
  }

  // Utente con score equity più basso tra i disponibili non ancora assegnati al giorno
  function getSuggestedUserId(dateStr: string): string | null {
    const assignedIds = new Set(shifts.filter((s) => s.date === dateStr).map((s) => s.user_id))
    const candidates = users.filter((u) => {
      if (assignedIds.has(u.id)) return false
      if (isWeekendBlocked(u.id, dateStr)) return false
      const avail = availabilityMap.get(`${u.id}-${dateStr}`)
      return avail?.available === true
    })
    if (candidates.length === 0) return null
    candidates.sort((a, b) => (equityScores.get(a.id) ?? 0) - (equityScores.get(b.id) ?? 0))
    return candidates[0].id
  }

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
          relative ${interactive ? 'min-h-[90px] sm:min-h-[110px] p-1.5' : 'min-h-[32px] sm:min-h-[40px] p-1'} rounded-lg transition-all
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

        {/* User chips — solo assegnati (rosso) e disponibili (verde), assegnati per primi */}
        {interactive && (
          <div className="mt-1 flex flex-wrap gap-0.5">
            {(() => {
              const relevant = users
                .map(u => ({ u, s: getUserChipStatus(u.id, dateStr) }))
                .filter(x => x.s !== 'unavailable')
                .sort((a, b) => (a.s === 'shift' ? -1 : b.s === 'shift' ? 1 : 0))
              const visible = relevant.slice(0, 11)
              const overflow = relevant.length - visible.length
              return (
                <>
                  {visible.map(({ u, s }) => {
                    const initials = u.nome.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
                    const color = s === 'shift' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                    return (
                      <span
                        key={u.id}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold ${color}`}
                        title={`${u.nome}: ${s === 'shift' ? 'Turno' : 'Disponibile'}`}
                        aria-hidden="true"
                      >{initials}</span>
                    )
                  })}
                  {overflow > 0 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] bg-gray-100 text-gray-400 font-medium" aria-hidden="true">
                      +{overflow}
                    </span>
                  )}
                </>
              )
            })()}
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
      <div className="flex flex-col gap-3 mb-5">

        {/* Month navigation — centered on all sizes */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('prev')}
            disabled={loadingMonth}
            className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Mese precedente"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 className="text-base font-semibold text-gray-900 min-w-[160px] text-center select-none">
            {loadingMonth ? (
              <span className="text-gray-400 text-sm">Caricamento...</span>
            ) : (
              `${MONTH_NAMES[viewMonth]} ${viewYear}`
            )}
          </h2>

          <button
            onClick={() => navigate('next')}
            disabled={loadingMonth}
            className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Mese successivo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Lock / unlock controls — full-width on mobile, auto on sm+ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          {locked ? (
            <>
              <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium select-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Mese confermato
              </span>
              <button
                onClick={() => setShowUnlockDialog(true)}
                disabled={unlockingMonth}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
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
      <div className="mb-4 space-y-2" aria-label="Legenda">
        {/* Chips calendario */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
          <LegendChip color="bg-green-400" label="Disponibile" />
          <LegendChip color="bg-red-400" label="Turno assegnato" />
          <LegendChip color="bg-gray-200" label="Non disponibile" />
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center shrink-0" aria-hidden="true">
              <svg className="w-2 h-2 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
            </span>
            Giorno coperto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center shrink-0 text-white text-[8px] font-bold" aria-hidden="true">!</span>
            Giorno scoperto
          </span>
        </div>
        {/* Badge pannello suggerimenti */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 border-t border-gray-100 pt-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-full">Pannello assegnazione</span>
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">★ Suggerito</span>
            <span>Score equità più basso</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] text-green-700">✓ ottimo</span>
            <span>Non ha lavorato né il mese scorso né il w.e. precedente</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] text-amber-600">⚠ recente</span>
            <span>Ha lavorato il mese scorso o il w.e. precedente</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] text-red-600">✕ evita</span>
            <span>Ha lavorato sia il mese scorso che il w.e. precedente</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-amber-600 font-medium">già in turno</span>
            <span>Già assegnato a un altro weekend questo mese</span>
          </span>
        </div>
      </div>

      {/* ---- Calendar grid ---- */}
      {loadingMonth ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Spinner />
          <span className="ml-2 text-sm">Caricamento calendario...</span>
        </div>
      ) : (
        <div
          className="grid grid-cols-7 gap-1 items-start"
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
                  className="min-h-[32px] sm:min-h-[40px] rounded-lg bg-gray-50/40"
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
              bottom-16 left-0 right-0 rounded-t-2xl max-h-[80vh]
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
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {users.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nessun dipendente attivo.</p>
              )}
              {(() => {
                const dateStr = selectedDay.dateStr
                const suggestedId = getSuggestedUserId(dateStr)

                const assigned   = users.filter(u => shiftMap.has(`${u.id}-${dateStr}`))
                const recOrder = { ideal: 0, neutral: 1, warning: 2, avoid: 3 }
                const available  = users
                  .filter(u => !shiftMap.has(`${u.id}-${dateStr}`) && availabilityMap.get(`${u.id}-${dateStr}`)?.available && !isWeekendBlocked(u.id, dateStr))
                  .sort((a, b) => {
                    const sa = a.id === suggestedId ? -1 : recOrder[getRecommendationLevel(a.id, dateStr)]
                    const sb = b.id === suggestedId ? -1 : recOrder[getRecommendationLevel(b.id, dateStr)]
                    return sa - sb
                  })
                const inTurno    = users.filter(u => !shiftMap.has(`${u.id}-${dateStr}`) && availabilityMap.get(`${u.id}-${dateStr}`)?.available && isWeekendBlocked(u.id, dateStr))
                const notAvail   = users.filter(u => !shiftMap.has(`${u.id}-${dateStr}`) && !availabilityMap.get(`${u.id}-${dateStr}`)?.available)

                return (
                  <>
                    {/* ── Assegnati oggi ── */}
                    {assigned.length > 0 && (
                      <section aria-label="Assegnati">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500 mb-1.5">
                          Assegnati ({assigned.length})
                        </p>
                        <ul className="space-y-1.5">
                          {assigned.map(u => (
                            <li key={u.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-red-50 border border-red-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                                <span className="text-sm font-medium text-gray-800 truncate">{u.nome}</span>
                              </div>
                              <div className="shrink-0">
                                {loadingAction === `${u.id}-${dateStr}` ? <Spinner small /> : !locked ? (
                                  <button
                                    onClick={() => setPendingAction({ userId: u.id, dateStr, userName: u.nome, action: 'remove' })}
                                    className="text-xs px-2.5 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                                  >Rimuovi</button>
                                ) : (
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* ── Disponibili ── */}
                    {available.length > 0 && (
                      <section aria-label="Disponibili">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600 mb-1.5">
                          Disponibili ({available.length})
                        </p>
                        <ul className="space-y-1.5">
                          {available.map(u => {
                            const rec = getRecommendationLevel(u.id, dateStr)
                            const suggested = u.id === suggestedId
                            const rowBg =
                              suggested    ? 'bg-blue-50 border-blue-200' :
                              rec === 'avoid'   ? 'bg-red-50 border-red-200' :
                              rec === 'warning' ? 'bg-amber-50 border-amber-200' :
                              'bg-green-50 border-green-100'
                            return (
                              <li key={u.id} className={`flex items-center justify-between gap-3 py-2 px-3 rounded-lg border ${rowBg}`}>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-800 truncate">{u.nome}</span>
                                    {suggested && <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">★ Suggerito</span>}
                                    {rec === 'ideal'   && <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded shrink-0">✓ ottimo</span>}
                                    {rec === 'warning' && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">⚠ recente</span>}
                                    {rec === 'avoid'   && <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded shrink-0">✕ evita</span>}
                                  </div>
                                </div>
                                {!locked && (
                                  <div className="shrink-0">
                                    {loadingAction === `${u.id}-${dateStr}` ? <Spinner small /> : (
                                      <button
                                        onClick={() => setPendingAction({ userId: u.id, dateStr, userName: u.nome, action: 'assign' })}
                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400"
                                      >Assegna</button>
                                    )}
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </section>
                    )}

                    {/* ── Già in turno questo mese ── */}
                    {inTurno.length > 0 && (
                      <section aria-label="Già in turno">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500 mb-1.5">
                          Già in turno questo mese ({inTurno.length})
                        </p>
                        <ul className="space-y-1">
                          {inTurno.map(u => (
                            <li key={u.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-amber-50 border border-amber-100">
                              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                              <span className="text-sm text-gray-700 truncate">{u.nome}</span>
                              <span className="text-[10px] text-amber-500 ml-auto shrink-0">ha già un weekend assegnato</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* ── Non disponibili (collassabile) ── */}
                    {notAvail.length > 0 && (
                      <details>
                        <summary className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 cursor-pointer select-none list-none flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          Non disponibili ({notAvail.length})
                        </summary>
                        <ul className="mt-1.5 space-y-1">
                          {notAvail.map(u => (
                            <li key={u.id} className="flex items-center gap-2 py-1 px-3 rounded text-xs text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                              <span>{u.nome}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )
              })()}
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
