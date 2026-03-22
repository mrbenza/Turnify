'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Shift, MonthStatus, ShiftType } from '@/lib/supabase/types'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ShiftRow extends Shift {
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
  userId: string
}

export default function StoricoTurni({ userId }: StoricoTurniProps) {
  const [turni, setTurni] = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTurni() {
      try {
        const supabase = createClient()

        const now = new Date()
        const from = new Date(now.getFullYear() - 1, now.getMonth(), 1)
        const fromStr = from.toISOString().slice(0, 10)
        const toStr = now.toISOString().slice(0, 10)

        const { data: rawShifts, error: shiftsError } = await supabase
          .from('shifts')
          .select('*')
          .eq('user_id', userId)
          .gte('date', fromStr)
          .lte('date', toStr)
          .order('date', { ascending: false })

        if (shiftsError) throw shiftsError

        const shiftsData = rawShifts ?? []

        if (shiftsData.length === 0) {
          setTurni([])
          return
        }

        // Collect unique year-month pairs
        const monthSet = new Set(
          shiftsData.map((s) => {
            const [year, month] = s.date.split('-').map(Number)
            return `${year}-${month}`
          })
        )

        const monthQueries = Array.from(monthSet).map((ym) => {
          const [year, month] = ym.split('-').map(Number)
          return { year, month }
        })

        // Fetch month statuses — build OR filter string for Supabase
        const orFilters = monthQueries
          .map((q) => `and(year.eq.${q.year},month.eq.${q.month})`)
          .join(',')

        const { data: rawStatuses } = await supabase
          .from('month_status')
          .select('*')
          .or(orFilters)

        const statusMap: Record<string, string> = {}
        const statusData = rawStatuses ?? []
        statusData.forEach((ms) => {
          statusMap[`${ms.year}-${ms.month}`] = ms.status
        })

        const enriched: ShiftRow[] = shiftsData.map((s) => {
          const [year, month] = s.date.split('-').map(Number)
          return {
            ...s,
            month_status_value: statusMap[`${year}-${month}`] ?? null,
          }
        })

        setTurni(enriched)
      } catch (err) {
        console.error('Errore caricamento storico turni:', err)
        setError('Impossibile caricare lo storico turni.')
      } finally {
        setLoading(false)
      }
    }

    fetchTurni()
  }, [userId])

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
        <svg
          className="w-5 h-5 animate-spin mr-2"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Caricamento storico...
      </div>
    )
  }

  /* ---- Error ---- */
  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3" role="alert">
        {error}
      </p>
    )
  }

  /* ---- Empty state ---- */
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
