import type { Shift, MonthStatus, ShiftType } from '@/lib/supabase/types'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ShiftRow extends Shift {
  month_status_value: string | null
}

const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  weekend: 'Weekend',
  festivo: 'Festivo',
  reperibilita: 'Reperibilità',
}

const MONTH_STATUS_DISPLAY: Record<string, { label: string; classes: string }> = {
  open: { label: 'Aperto', classes: 'bg-blue-50 text-blue-700' },
  approved: { label: 'Approvato', classes: 'bg-yellow-50 text-yellow-700' },
  locked: { label: 'Chiuso', classes: 'bg-gray-100 text-gray-600' },
  confirmed: { label: 'Confermato', classes: 'bg-green-50 text-green-700' },
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface StoricoTurniProps {
  turni: ShiftRow[]
}

export default function StoricoTurni({ turni }: StoricoTurniProps) {
  if (turni.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        Nessun turno assegnato negli ultimi 12 mesi.
      </p>
    )
  }

  /* ---- Table / Cards ---- */
  return (
    <>
      {/* Mobile cards (< sm) */}
      <div className="sm:hidden space-y-3" aria-label="Storico turni assegnati">
        {turni.map((turno) => {
          const statusInfo = turno.month_status_value
            ? (MONTH_STATUS_DISPLAY[turno.month_status_value] ?? {
                label: turno.month_status_value,
                classes: 'bg-gray-50 text-gray-500',
              })
            : { label: '—', classes: 'text-gray-400' }

          return (
            <div
              key={turno.id}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{formatDate(turno.date)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{SHIFT_TYPE_LABELS[turno.shift_type]}</p>
              </div>
              <span
                className={`shrink-0 inline-block px-2 py-1 rounded-full text-xs font-medium ${statusInfo.classes}`}
              >
                {statusInfo.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Desktop table (sm+) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" aria-label="Storico turni assegnati">
          <thead>
            <tr className="border-b border-gray-100">
              <th
                scope="col"
                className="text-left py-2 px-0 font-semibold text-gray-500 text-xs uppercase tracking-wide"
              >
                Data
              </th>
              <th
                scope="col"
                className="text-left py-2 px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide"
              >
                Tipo
              </th>
              <th
                scope="col"
                className="text-left py-2 px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide"
              >
                Stato mese
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {turni.map((turno) => {
              const statusInfo = turno.month_status_value
                ? (MONTH_STATUS_DISPLAY[turno.month_status_value] ?? {
                    label: turno.month_status_value,
                    classes: 'bg-gray-50 text-gray-500',
                  })
                : { label: '—', classes: 'text-gray-400' }

              return (
                <tr key={turno.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-0 text-gray-700 whitespace-nowrap">
                    {formatDate(turno.date)}
                  </td>
                  <td className="py-2.5 px-2 text-gray-600">
                    {SHIFT_TYPE_LABELS[turno.shift_type]}
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.classes}`}
                    >
                      {statusInfo.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
