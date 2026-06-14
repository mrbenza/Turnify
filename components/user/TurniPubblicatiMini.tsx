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
}: TurniPubblicatiMiniProps) {
  const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]))
  const groupedShifts = groupShiftsByDate(shifts)
  const currentUserShiftCount = shifts.filter((shift) => shift.user_id === currentUserId).length

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
                  <span className="text-xs font-medium uppercase tracking-wide">
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
