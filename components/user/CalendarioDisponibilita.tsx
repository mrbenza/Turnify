'use client'

import { useState, useTransition, useCallback } from 'react'
import type { Availability, Holiday, Shift, SchedulingMode } from '@/lib/supabase/types'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CalendarioDisponibilitaProps {
  userId: string
  availabilityList: Availability[]
  holidays: Holiday[]
  shifts: Shift[]
  lockedMonths: Set<string>
  schedulingMode?: SchedulingMode
}

type DayState =
  | 'weekday'
  | 'available'
  | 'unavailable'
  | 'approved'
  | 'shift-pending'
  | 'shift-confirmed'
  | 'holiday-free'

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

function isBefore(dateStr: string, today: string): boolean {
  return dateStr < today
}

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CalendarioDisponibilita({
  userId,
  availabilityList,
  holidays,
  shifts,
  lockedMonths,
  schedulingMode = 'weekend_full',
}: CalendarioDisponibilitaProps) {
  const today = new Date()
  const todayStr = toDateString(today.getFullYear(), today.getMonth(), today.getDate())

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // Optimistic local state for availability
  const [localAvailability, setLocalAvailability] = useState<Availability[]>(availabilityList)

  const availabilityByDate = Object.fromEntries(
    localAvailability.map((a) => [a.date, a])
  )
  const shiftDates = new Set(shifts.map((s) => s.date))
  const holidayDates = new Set(holidays.map((h) => h.date))

  const [savingDates, setSavingDates] = useState<Set<string>>(new Set())
  const [tooltip, setTooltip] = useState<{ date: string; msg: string } | null>(null)
  const [bannerMsg, setBannerMsg] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  /* ---- Navigation ---- */
  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth())

  function goToPrev() {
    if (!canGoPrev) return
    setBannerMsg(null)
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }

  function goToNext() {
    setBannerMsg(null)
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  /* ---- Day classification ---- */
  function getDayState(dateStr: string): DayState {
    // Shift assigned: color depends on whether the month is locked
    if (shiftDates.has(dateStr)) {
      const monthKey = dateStr.slice(0, 7) // "YYYY-MM"
      return lockedMonths.has(monthKey) ? 'shift-confirmed' : 'shift-pending'
    }
    const avail = availabilityByDate[dateStr]
    if (avail) {
      // approved (Excel downloaded) or locked status → confirmed/red
      if (avail.status === 'approved') return 'approved'
      if (avail.status === 'locked') return 'shift-confirmed'
      return avail.available ? 'available' : 'unavailable'
    }
    const [year, month, day] = dateStr.split('-').map(Number)
    const weekend = isWeekend(year, month - 1, day)
    const isHol = holidayDates.has(dateStr)
    return weekend || isHol ? 'holiday-free' : 'weekday'
  }

  function isClickable(dateStr: string, state: DayState): boolean {
    if (isBefore(dateStr, todayStr)) return false
    if (
      state === 'shift-pending' ||
      state === 'shift-confirmed' ||
      state === 'approved' ||
      state === 'weekday'
    ) return false
    return true
  }

  /* ---- Calcola il giorno partner in base al scheduling_mode ----
   *
   * weekend_full  → Sab↔Dom della stessa settimana (Sab+1=Dom, Dom-1=Sab)
   * sun_next_sat  → Dom↔Sab della settimana successiva (Dom+6=Sab, Sab-6=Dom)
   * single_day    → nessun abbinamento
   */
  function getWeekendPartner(dateStr: string): string | null {
    if (schedulingMode === 'single_day') return null

    const [y, m, d] = dateStr.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay() // 0=Dom, 6=Sab

    if (schedulingMode === 'weekend_full') {
      if (dow === 6) {
        // Sab → Dom successiva
        const sun = new Date(y, m - 1, d + 1)
        const sunStr = toDateString(sun.getFullYear(), sun.getMonth(), sun.getDate())
        return holidayDates.has(sunStr) ? null : sunStr
      }
      if (dow === 0) {
        // Dom → Sab precedente
        const sat = new Date(y, m - 1, d - 1)
        const satStr = toDateString(sat.getFullYear(), sat.getMonth(), sat.getDate())
        return holidayDates.has(satStr) ? null : satStr
      }
    }

    if (schedulingMode === 'sun_next_sat') {
      if (dow === 0) {
        // Dom → Sab della settimana successiva (+6)
        const sat = new Date(y, m - 1, d + 6)
        const satStr = toDateString(sat.getFullYear(), sat.getMonth(), sat.getDate())
        return holidayDates.has(satStr) ? null : satStr
      }
      if (dow === 6) {
        // Sab → Dom della settimana precedente (-6)
        const sun = new Date(y, m - 1, d - 6)
        const sunStr = toDateString(sun.getFullYear(), sun.getMonth(), sun.getDate())
        return holidayDates.has(sunStr) ? null : sunStr
      }
    }

    return null
  }

  /* ---- Click handler ---- */
  const handleDayClick = useCallback(
    async (dateStr: string) => {
      const monthKey = dateStr.slice(0, 7)
      if (lockedMonths.has(monthKey)) {
        setBannerMsg('Il mese e confermato e non puoi piu modificare la disponibilita.')
        return
      }

      const state = getDayState(dateStr)
      if (!isClickable(dateStr, state)) {
        if (state === 'approved' || state === 'shift-confirmed' || state === 'shift-pending') {
          setTooltip({ date: dateStr, msg: 'Non modificabile' })
          setTimeout(() => setTooltip(null), 2000)
        } else if (isBefore(dateStr, todayStr)) {
          setBannerMsg('Non puoi modificare la disponibilità per giorni già trascorsi.')
        }
        return
      }

      setBannerMsg(null)

      const existing = availabilityByDate[dateStr]
      const newAvailable = existing ? !existing.available : true

      // Trova il partner del weekend (Sab↔Dom), solo se clickable
      const partner = getWeekendPartner(dateStr)
      const partnerClickable = partner ? isClickable(partner, getDayState(partner)) : false
      const datesToSave = [dateStr, ...(partner && partnerClickable ? [partner] : [])]

      setSavingDates(new Set(datesToSave))

      const snapshot = localAvailability

      // Optimistic update per tutte le date
      startTransition(() =>
        setLocalAvailability((prev) => {
          let updated = [...prev]
          for (const dt of datesToSave) {
            const ex = updated.find((a) => a.date === dt)
            if (!ex) {
              updated = [...updated, {
                id: `temp-${dt}`, user_id: userId, date: dt,
                available: newAvailable, status: 'pending' as const,
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                area_id: '',
              }]
            } else {
              updated = updated.map((a) => a.date === dt ? { ...a, available: newAvailable } : a)
            }
          }
          return updated
        })
      )

      try {
        const results = await Promise.all(
          datesToSave.map((dt) =>
            fetch('/api/availability', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: dt, available: newAvailable }),
            }).then((r) => r.ok ? r.json() as Promise<Availability> : r.json().then((j) => { throw new Error(j.error ?? 'Errore') }))
          )
        )
        // Sostituisce i record temporanei con quelli reali
        startTransition(() =>
          setLocalAvailability((prev) => {
            let updated = [...prev]
            for (const data of results) {
              updated = updated.map((a) => (a.id === `temp-${data.date}` || a.id === data.id) ? data : a)
            }
            return updated
          })
        )
      } catch (err) {
        console.error('Errore salvataggio disponibilità:', err)
        setBannerMsg(err instanceof Error ? err.message : 'Errore durante il salvataggio. Riprova.')
        startTransition(() => setLocalAvailability(snapshot))
      } finally {
        setSavingDates(new Set())
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availabilityByDate, localAvailability, lockedMonths, userId, todayStr, holidayDates]
  )

  /* ---- Build calendar grid ---- */
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  /* ---- Cell styles ---- */
  function cellClasses(state: DayState, isPast: boolean, clickable: boolean): string {
    const base =
      'relative flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 min-h-[44px] sm:min-h-[52px] select-none'
    const opacityClass = isPast ? 'opacity-40' : ''

    const map: Record<DayState, string> = {
      weekday: `${base} bg-gray-100 text-gray-400 cursor-default`,
      'holiday-free': `${base} bg-white border-2 border-gray-200 text-gray-700 ${clickable && !isPast ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50' : 'cursor-default'}`,
      available: `${base} bg-green-100 border-2 border-green-400 text-green-800 ${clickable && !isPast ? 'cursor-pointer hover:bg-green-200' : 'cursor-default'}`,
      unavailable: `${base} bg-white border-2 border-gray-200 text-gray-500 ${clickable && !isPast ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'}`,
      // Turno assegnato, mese non ancora locked → giallo
      'shift-pending': `${base} bg-yellow-100 border-2 border-yellow-400 text-yellow-800 cursor-default`,
      // Turno assegnato con mese locked, oppure availability approved → rosso
      'shift-confirmed': `${base} bg-red-100 border-2 border-red-400 text-red-800 cursor-default`,
      // availability.status === 'approved' (Excel scaricato) → rosso, stessa di shift-confirmed
      approved: `${base} bg-red-100 border-2 border-red-400 text-red-800 cursor-default`,
    }

    return `${map[state]} ${opacityClass}`.trim()
  }

  /* ---- Render ---- */
  return (
    <section aria-label="Calendario disponibilità">
      {/* Month navigation header */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={goToPrev}
          disabled={!canGoPrev}
          className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Mese precedente"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="text-base sm:text-lg font-semibold text-gray-900 text-center min-w-[160px]">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>

        <button
          onClick={goToNext}
          className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Mese successivo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs font-semibold text-gray-400 py-1">
            {label}
          </div>
        ))}
      </div>

      {bannerMsg && (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
          aria-live="polite"
        >
          {bannerMsg}
        </div>
      )}

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} aria-hidden="true" />
          }

          const dateStr = toDateString(viewYear, viewMonth, day)
          const state = getDayState(dateStr)
          const isPast = isBefore(dateStr, todayStr)
          const clickable = isClickable(dateStr, state)
          const isSaving = savingDates.has(dateStr)
          const showTooltip = tooltip?.date === dateStr

          return (
            <div
              key={dateStr}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={`${day} ${MONTH_NAMES[viewMonth]}: ${state}`}
              aria-pressed={clickable && state === 'available' ? true : undefined}
              className={cellClasses(state, isPast, clickable)}
              onClick={() => handleDayClick(dateStr)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleDayClick(dateStr)
                }
              }}
            >
              {/* Day number */}
              <span className={isSaving ? 'opacity-0' : ''}>{day}</span>

              {/* Spinner while saving */}
              {isSaving && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 animate-spin text-blue-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                </span>
              )}

              {/* Non-modifiable tooltip */}
              {showTooltip && (
                <span
                  role="tooltip"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap bg-gray-800 text-white text-xs rounded px-2 py-1 z-10 pointer-events-none"
                >
                  {tooltip!.msg}
                </span>
              )}

              {/* Holiday marker dot */}
              {holidayDates.has(dateStr) && (
                <span
                  className="w-1 h-1 rounded-full bg-blue-400 mt-0.5 absolute bottom-1.5"
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend — 2-column grid on mobile, wrapping flex on sm+ */}
      <div
        className="mt-5 grid grid-cols-2 sm:flex sm:flex-wrap gap-3 text-xs text-gray-600"
        aria-label="Legenda colori calendario"
      >
        <LegendItem color="bg-gray-100" label="Feriale" />
        <LegendItem color="bg-white border-2 border-gray-200" label="Sab / Dom / Festività" />
        <LegendItem color="bg-green-100 border-2 border-green-400" label="Disponibile" />
        <LegendItem color="bg-yellow-100 border-2 border-yellow-400" label="Turno assegnato" />
        <LegendItem color="bg-red-100 border-2 border-red-400" label="Mese confermato" />
      </div>
    </section>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-4 h-4 rounded ${color} inline-block shrink-0`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
