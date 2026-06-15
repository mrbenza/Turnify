import type { Holiday, ShiftType } from '@/lib/supabase/types'

export type PublishedShift = {
  id: string
  date: string
  user_id: string
  user_nome: string | null
  shift_type: ShiftType
  reperibile_order: number
}

type TurniPubblicatiMiniProps = {
  year: number
  month: number
  areaNome: string | null
  currentUserId: string
  shifts: PublishedShift[]
  holidays: Pick<Holiday, 'date' | 'name' | 'mandatory'>[]
  variant?: 'section' | 'inline'
}

const MONTH_NAMES = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
]

const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

const SHIFT_LABELS: Record<ShiftType, string> = {
  weekend: 'Weekend',
  festivo: 'Festivo',
  reperibilita: 'Reperibilita',
}

function parseDateParts(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

function getWeekdayName(dateStr: string) {
  const { year, month, day } = parseDateParts(dateStr)
  return WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()]
}

function isWeekend(dateStr: string) {
  const { year, month, day } = parseDateParts(dateStr)
  const dow = new Date(year, month - 1, day).getDay()
  return dow === 0 || dow === 6
}

function groupShiftsByDate(shifts: PublishedShift[]) {
  const grouped = new Map<string, PublishedShift[]>()

  for (const shift of shifts) {
    const dayShifts = grouped.get(shift.date) ?? []
    dayShifts.push(shift)
    grouped.set(shift.date, dayShifts)
  }

  return [...grouped.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, dayShifts]) => [
      date,
      dayShifts.sort((a, b) => a.reperibile_order - b.reperibile_order),
    ] as const)
}

export default function TurniPubblicatiMini({
  year,
  month,
  areaNome,
  currentUserId,
  shifts,
  holidays,
  variant = 'section',
}: TurniPubblicatiMiniProps) {
  const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]))
  const groupedShifts = groupShiftsByDate(shifts)
  const currentUserShiftCount = shifts.filter((shift) => shift.user_id === currentUserId).length

  if (variant === 'inline') {
    return (
      <div
        aria-labelledby="turni-pubblicati-heading"
        className="mt-5 border-t border-gray-100 pt-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3
              id="turni-pubblicati-heading"
              className="text-sm font-semibold text-gray-900"
            >
              Turni pubblicati
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Snapshot del mese confermato
              {areaNome ? ` - ${areaNome}` : ''}
            </p>
          </div>

          <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
            {currentUserShiftCount > 0
              ? `${currentUserShiftCount} turn${currentUserShiftCount === 1 ? 'o' : 'i'} per te`
              : 'Nessun tuo turno'}
          </span>
        </div>

        {groupedShifts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600">
            Nessun turno pubblicato per {MONTH_NAMES[month - 1]} {year}.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <div className="border-b border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
              {MONTH_NAMES[month - 1]} {year}
            </div>

            <div className="divide-y divide-gray-200">
              {groupedShifts.map(([date, dayShifts]) => {
                const { day } = parseDateParts(date)
                const holiday = holidaysByDate.get(date)
                const dayIsWeekend = isWeekend(date)

                return (
                  <article
                    key={date}
                    className={holiday ? 'bg-amber-50/70' : dayIsWeekend ? 'bg-white' : 'bg-gray-50'}
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <div
                        className={`flex shrink-0 flex-col items-center justify-center rounded-md border text-center ${
                          holiday
                            ? 'border-amber-200 bg-amber-100 text-amber-950'
                            : 'border-gray-200 bg-white text-gray-900'
                        }`}
                        style={{ width: 48, height: 42 }}
                      >
                        <span className="text-xs font-medium uppercase leading-none">
                          {getWeekdayName(date)}
                        </span>
                        <span className="mt-0.5 text-base font-semibold leading-none">{day}</span>
                      </div>

                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className="flex min-w-0 shrink-0 flex-wrap items-center gap-1.5"
                          style={{ width: 150 }}
                        >
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-xs font-medium leading-none ${
                              holiday
                                ? 'bg-amber-200 text-amber-950'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {holiday ? 'Festivo' : 'Weekend'}
                          </span>
                          {holiday && (
                            <span className="text-xs font-medium text-amber-950">
                              {holiday.name}
                            </span>
                          )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                          {dayShifts.map((shift) => {
                            const isCurrentUser = shift.user_id === currentUserId

                            return (
                              <div
                                key={shift.id}
                                className={`rounded-md border px-2.5 py-1.5 ${
                                  isCurrentUser
                                    ? 'border-emerald-200 bg-emerald-50'
                                    : 'border-gray-200 bg-white'
                                }`}
                                style={{ minWidth: 170, maxWidth: 240 }}
                              >
                                <p className="truncate text-sm font-semibold leading-tight text-gray-900">
                                  {shift.user_nome ?? 'Utente'}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <section
      aria-labelledby="turni-pubblicati-heading"
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="turni-pubblicati-heading"
            className="text-base font-semibold text-gray-900"
          >
            Turni pubblicati
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {MONTH_NAMES[month - 1]} {year}
            {areaNome ? ` - ${areaNome}` : ''}
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {currentUserShiftCount > 0
            ? `Hai ${currentUserShiftCount} turn${currentUserShiftCount === 1 ? 'o' : 'i'} assegnat${currentUserShiftCount === 1 ? 'o' : 'i'}.`
            : 'Non hai turni assegnati questo mese.'}
        </div>
      </div>

      {groupedShifts.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600">
          Nessun turno pubblicato per questo mese.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {groupedShifts.map(([date, dayShifts]) => {
            const { day } = parseDateParts(date)
            const holiday = holidaysByDate.get(date)
            const isHoliday = Boolean(holiday)

            return (
              <article
                key={date}
                className={`flex gap-3 rounded-xl border p-3 ${
                  isHoliday
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div
                  className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg text-white ${
                    isHoliday ? 'bg-amber-600' : 'bg-slate-900'
                  }`}
                >
                  <span className="text-xs font-medium uppercase">
                    {getWeekdayName(date)}
                  </span>
                  <span className="text-2xl font-semibold leading-none">{day}</span>
                </div>

                <div className="min-w-0 flex-1">
                  {holiday && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Festivo
                      </span>
                      <span className="text-sm font-medium text-amber-950">
                        {holiday.name}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {dayShifts.map((shift) => {
                      const isCurrentUser = shift.user_id === currentUserId

                      return (
                        <div
                          key={shift.id}
                          className={`flex flex-col gap-1 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
                            isCurrentUser
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-white bg-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {shift.user_nome ?? 'Utente'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {SHIFT_LABELS[shift.shift_type]} #{shift.reperibile_order}
                            </p>
                          </div>

                          {isCurrentUser && (
                            <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                              Il tuo turno
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
