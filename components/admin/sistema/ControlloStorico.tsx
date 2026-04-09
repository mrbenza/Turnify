'use client'

import { useState, useCallback } from 'react'

interface AreaRow {
  id: string
  nome: string
  manager_nome: string | null
  storico_abilitato: boolean
}

interface Props {
  initialAreas: AreaRow[]
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${checked ? 'bg-blue-600' : 'bg-gray-200'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
          transition-transform duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

export default function ControlloStorico({ initialAreas }: Props) {
  const [areas, setAreas] = useState<AreaRow[]>(initialAreas)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(async (id: string, currentValue: boolean) => {
    setLoadingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/areas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storico_abilitato: !currentValue }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Errore ${res.status}`)
      }
      setAreas(prev => prev.map(a => a.id === id ? { ...a, storico_abilitato: !currentValue } : a))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'aggiornamento')
    } finally {
      setLoadingId(null)
    }
  }, [])

  const bulkSet = useCallback(async (value: boolean) => {
    setBulkLoading(true)
    setError(null)
    try {
      await Promise.all(
        areas
          .filter(a => a.storico_abilitato !== value)
          .map(a =>
            fetch(`/api/areas/${a.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ storico_abilitato: value }),
            })
          )
      )
      setAreas(prev => prev.map(a => ({ ...a, storico_abilitato: value })))
    } catch {
      setError('Errore durante l\'operazione su tutte le aree')
    } finally {
      setBulkLoading(false)
    }
  }, [areas])

  const abilitateCount = areas.filter(a => a.storico_abilitato).length

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Importazione storico</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Controlla quali aree possono importare turni storici
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span className="text-xs text-gray-400">
            {abilitateCount}/{areas.length} abilitate
          </span>
          <button
            onClick={() => bulkSet(true)}
            disabled={bulkLoading || abilitateCount === areas.length}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
          >
            Abilita tutte
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => bulkSet(false)}
            disabled={bulkLoading || abilitateCount === 0}
            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
          >
            Disabilita tutte
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {error}
        </p>
      )}

      {areas.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nessuna area configurata</p>
      ) : (
        <ul className="space-y-2">
          {areas.map(area => (
            <li
              key={area.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              {/* Pallino colorato con iniziale */}
              <span
                className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                {area.nome.charAt(0).toUpperCase()}
              </span>

              {/* Info area */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{area.nome}</p>
                <p className="text-xs text-gray-400 truncate">
                  {area.manager_nome ?? 'Nessun manager assegnato'}
                </p>
              </div>

              {/* Badge stato */}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  area.storico_abilitato
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {area.storico_abilitato ? 'Abilitata' : 'Bloccata'}
              </span>

              {/* Toggle */}
              <Toggle
                checked={area.storico_abilitato}
                onChange={() => toggle(area.id, area.storico_abilitato)}
                disabled={loadingId === area.id || bulkLoading}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
