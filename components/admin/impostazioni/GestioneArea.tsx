'use client'

import { useState } from 'react'
import type { SchedulingMode } from '@/lib/supabase/types'

interface GestioneAreaProps {
  initialSchedulingMode: SchedulingMode
  initialWorkersPerDay: 1 | 2
}

const MODES: { value: SchedulingMode; label: string; description: string }[] = [
  {
    value: 'weekend_full',
    label: 'Weekend completo',
    description: 'Chi lavora sabato lavora anche domenica (e viceversa). Coppia Sab+Dom assegnata alla stessa persona.',
  },
  {
    value: 'single_day',
    label: 'Giorno singolo',
    description: 'Sabato e domenica sono indipendenti: persone diverse possono coprire i due giorni. Ogni dipendente fa al massimo 1 giorno speciale al mese.',
  },
  {
    value: 'sun_next_sat',
    label: 'Dom → Sab settimana dopo',
    description: 'Chi lavora domenica viene automaticamente assegnato al sabato della settimana successiva.',
  },
]

export default function GestioneArea({
  initialSchedulingMode,
  initialWorkersPerDay,
}: GestioneAreaProps) {
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>(initialSchedulingMode)
  const [workersPerDay, setWorkersPerDay] = useState<1 | 2>(initialWorkersPerDay)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isDirty =
    schedulingMode !== initialSchedulingMode || workersPerDay !== initialWorkersPerDay

  async function handleSave() {
    setSaving(true)
    setSuccessMsg(null)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduling_mode: schedulingMode, workers_per_day: workersPerDay }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      setSuccessMsg('Impostazioni salvate.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante il salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Logica di turnazione</h3>
        <p className="text-xs text-gray-500 mb-3">
          Determina come vengono abbinati i giorni e calcolati i suggerimenti di equità.
        </p>
        <div className="space-y-2">
          {MODES.map((mode) => (
            <label
              key={mode.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                schedulingMode === mode.value
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="scheduling_mode"
                value={mode.value}
                checked={schedulingMode === mode.value}
                onChange={() => setSchedulingMode(mode.value)}
                className="mt-0.5 accent-blue-600 shrink-0"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">{mode.label}</span>
                <p className="text-xs text-gray-500 mt-0.5">{mode.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Reperibili per giorno</h3>
        <p className="text-xs text-gray-500 mb-3">
          Numero massimo di persone assegnabili allo stesso giorno.
        </p>
        <div className="flex gap-3">
          {([1, 2] as const).map((n) => (
            <label
              key={n}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                workersPerDay === n
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="workers_per_day"
                value={n}
                checked={workersPerDay === n}
                onChange={() => setWorkersPerDay(n)}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium">
                {n === 1 ? '1 reperibile' : '2 reperibili'}
              </span>
            </label>
          ))}
        </div>
        {workersPerDay === 2 && (
          <p className="text-xs text-gray-400 mt-2">
            Il secondo reperibile è il sostituto in caso di malattia o supporto al primo.
          </p>
        )}
      </div>

      {successMsg && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {successMsg}
        </p>
      )}
      {errorMsg && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {saving ? 'Salvataggio…' : 'Salva impostazioni'}
        </button>
      </div>
    </div>
  )
}
