'use client'

import { useState, useCallback } from 'react'
import type { Area, User, SchedulingMode } from '@/lib/supabase/types'
import Select from '@/components/ui/Select'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const SCHEDULING_MODE_LABELS: Record<SchedulingMode, string> = {
  weekend_full: 'Weekend completo',
  single_day: 'Giornata singola',
  sun_next_sat: 'Dom → Sab',
}

const SCHEDULING_MODE_COLORS: Record<SchedulingMode, string> = {
  weekend_full: 'bg-blue-50 text-blue-700',
  single_day: 'bg-green-50 text-green-700',
  sun_next_sat: 'bg-purple-50 text-purple-700',
}

const VALID_MODES: SchedulingMode[] = ['weekend_full', 'single_day', 'sun_next_sat']

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Modal: Nuova area                                                   */
/* ------------------------------------------------------------------ */

interface NuovaAreaModalProps {
  onClose: () => void
  onCreated: (area: Area) => void
}

function NuovaAreaModal({ onClose, onCreated }: NuovaAreaModalProps) {
  const [nome, setNome] = useState('')
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>('weekend_full')
  const [workersPerDay, setWorkersPerDay] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), scheduling_mode: schedulingMode, workers_per_day: workersPerDay }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Errore ${res.status}`)
      onCreated(json as Area)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-nuova-area-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="modal-nuova-area-title" className="text-base font-semibold text-gray-900">
            Nuova area
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="nuova-nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome area <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="nuova-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="es. Area Nord"
            />
          </div>

          <div>
            <label htmlFor="nuova-mode" className="block text-sm font-medium text-gray-700 mb-1">
              Modalità scheduling
            </label>
            <Select
              id="nuova-mode"
              value={schedulingMode}
              onChange={(v) => setSchedulingMode(v as SchedulingMode)}
              options={VALID_MODES.map((m) => ({ value: m, label: SCHEDULING_MODE_LABELS[m] }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label htmlFor="nuova-workers" className="block text-sm font-medium text-gray-700 mb-1">
              Lavoratori per giorno
            </label>
            <Select
              id="nuova-workers"
              value={String(workersPerDay)}
              onChange={(v) => setWorkersPerDay(Number(v) as 1 | 2)}
              options={[
                { value: '1', label: '1 lavoratore' },
                { value: '2', label: '2 lavoratori' },
              ]}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-lg"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !nome.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {loading && <Spinner />}
              Crea area
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal: Modifica area                                                */
/* ------------------------------------------------------------------ */

interface ModificaAreaModalProps {
  area: Area
  areas: Area[]
  managers: User[]
  onClose: () => void
  onUpdated: (area: Area) => void
}

function ModificaAreaModal({ area, areas, managers, onClose, onUpdated }: ModificaAreaModalProps) {
  const [nome, setNome] = useState(area.nome)
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>(area.scheduling_mode)
  const [workersPerDay, setWorkersPerDay] = useState<1 | 2>(area.workers_per_day)
  const [managerId, setManagerId] = useState<string>(area.manager_id ?? '')

  // Area attuale del manager selezionato (se diversa dall'area corrente)
  const selectedManagerCurrentArea = managerId
    ? areas.find((a) => a.manager_id === managerId && a.id !== area.id)
    : null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/areas/${area.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          scheduling_mode: schedulingMode,
          workers_per_day: workersPerDay,
          manager_id: managerId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Errore ${res.status}`)
      onUpdated(json as Area)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'aggiornamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-modifica-area-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="modal-modifica-area-title" className="text-base font-semibold text-gray-900">
            Modifica area
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="modifica-nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome area <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="modifica-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label htmlFor="modifica-mode" className="block text-sm font-medium text-gray-700 mb-1">
              Modalità scheduling
            </label>
            <Select
              id="modifica-mode"
              value={schedulingMode}
              onChange={(v) => setSchedulingMode(v as SchedulingMode)}
              options={VALID_MODES.map((m) => ({ value: m, label: SCHEDULING_MODE_LABELS[m] }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label htmlFor="modifica-workers" className="block text-sm font-medium text-gray-700 mb-1">
              Lavoratori per giorno
            </label>
            <Select
              id="modifica-workers"
              value={String(workersPerDay)}
              onChange={(v) => setWorkersPerDay(Number(v) as 1 | 2)}
              options={[
                { value: '1', label: '1 lavoratore' },
                { value: '2', label: '2 lavoratori' },
              ]}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label htmlFor="modifica-manager" className="block text-sm font-medium text-gray-700 mb-1">
              Manager
            </label>
            <Select
              id="modifica-manager"
              value={managerId}
              onChange={setManagerId}
              options={[
                { value: '', label: 'Nessun manager' },
                ...managers.map((m) => {
                  const currentArea = areas.find((a) => a.manager_id === m.id && a.id !== area.id)
                  return { value: m.id, label: currentArea ? `${m.nome} — ${currentArea.nome}` : m.nome }
                }),
              ]}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {selectedManagerCurrentArea && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-xs text-amber-700">
                  <strong>{managers.find((m) => m.id === managerId)?.nome}</strong> è attualmente manager di{' '}
                  <strong>{selectedManagerCurrentArea.nome}</strong>. Salvando, verrà spostato in questa area e{' '}
                  <strong>{selectedManagerCurrentArea.nome}</strong> rimarrà senza manager.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-lg"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !nome.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {loading && <Spinner />}
              Salva modifiche
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Drawer: Dipendenti                                                  */
/* ------------------------------------------------------------------ */

interface DipendentiDrawerProps {
  area: Area
  allAreas: Area[]
  allUsers: User[]
  onClose: () => void
  onUserMoved: (userId: string, newAreaId: string) => void
}

function DipendentiDrawer({ area, allAreas, allUsers, onClose, onUserMoved }: DipendentiDrawerProps) {
  // Utenti in questa area (non admin)
  const areaUsers = allUsers.filter((u) => u.area_id === area.id && u.ruolo !== 'admin')
  // Utenti in altre aree (da aggiungere)
  const otherUsers = allUsers.filter((u) => u.area_id !== area.id && u.ruolo !== 'admin')
  // Altre aree disponibili
  const otherAreas = allAreas.filter((a) => a.id !== area.id)

  const [movingUserId, setMovingUserId] = useState<string | null>(null)
  const [moveTargetAreaId, setMoveTargetAreaId] = useState<Record<string, string>>({})
  const [addUserId, setAddUserId] = useState('')
  const [loadingMove, setLoadingMove] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleMoveUser(userId: string, targetAreaId: string) {
    if (!targetAreaId) return
    setLoadingMove(userId)
    setError(null)
    try {
      const res = await fetch(`/api/areas/${targetAreaId}/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Errore ${res.status}`)
      onUserMoved(userId, targetAreaId)
      setMovingUserId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante lo spostamento')
    } finally {
      setLoadingMove(null)
    }
  }

  async function handleAddUser() {
    if (!addUserId) return
    setLoadingMove(addUserId)
    setError(null)
    try {
      const res = await fetch(`/api/areas/${area.id}/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: addUserId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Errore ${res.status}`)
      onUserMoved(addUserId, area.id)
      setAddUserId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'aggiunta')
    } finally {
      setLoadingMove(null)
    }
  }

  const roleLabel: Record<string, string> = {
    manager: 'Manager',
    dipendente: 'Dipendente',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col"
        role="complementary"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 id="drawer-title" className="text-base font-semibold text-gray-900">
              Dipendenti
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{area.nome}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Chiudi pannello dipendenti"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          {/* Lista dipendenti correnti */}
          <section aria-labelledby="drawer-current-heading">
            <h3 id="drawer-current-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              In questa area ({areaUsers.length})
            </h3>
            {areaUsers.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Nessun dipendente in questa area.</p>
            ) : (
              <ul className="space-y-2" aria-label="Dipendenti dell'area">
                {areaUsers.map((u) => {
                  const isMoving = movingUserId === u.id
                  const targetAreaId = moveTargetAreaId[u.id] ?? ''
                  const isLoading = loadingMove === u.id

                  return (
                    <li key={u.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.nome}</p>
                          <p className="text-xs text-gray-400">{roleLabel[u.ruolo] ?? u.ruolo}</p>
                        </div>
                        {otherAreas.length > 0 && (
                          <button
                            onClick={() => setMovingUserId(isMoving ? null : u.id)}
                            className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1"
                            aria-expanded={isMoving}
                          >
                            Sposta
                          </button>
                        )}
                      </div>

                      {isMoving && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={targetAreaId}
                            onChange={(v) => setMoveTargetAreaId((prev) => ({ ...prev, [u.id]: v }))}
                            options={[
                              { value: '', label: 'Seleziona area...' },
                              ...otherAreas.map((a) => ({ value: a.id, label: a.nome })),
                            ]}
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                            aria-label={`Seleziona area di destinazione per ${u.nome}`}
                          />
                          <button
                            onClick={() => handleMoveUser(u.id, targetAreaId)}
                            disabled={!targetAreaId || isLoading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            {isLoading ? <Spinner className="w-3 h-3" /> : null}
                            OK
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Aggiungi dipendente da altra area */}
          {otherUsers.length > 0 && (
            <section aria-labelledby="drawer-add-heading">
              <h3 id="drawer-add-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Aggiungi dipendente
              </h3>
              <div className="flex items-center gap-2">
                <Select
                  value={addUserId}
                  onChange={setAddUserId}
                  options={[
                    { value: '', label: 'Seleziona dipendente...' },
                    ...otherUsers.map((u) => ({
                      value: u.id,
                      label: `${u.nome} — ${u.area_id ? allAreas.find((a) => a.id === u.area_id)?.nome ?? 'Area sconosciuta' : 'Senza area'}`,
                    })),
                  ]}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label="Seleziona dipendente da aggiungere"
                />
                <button
                  onClick={handleAddUser}
                  disabled={!addUserId || loadingMove === addUserId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label="Aggiungi dipendente selezionato a questa area"
                >
                  {loadingMove === addUserId ? <Spinner /> : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  Aggiungi
                </button>
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Main component: GestioneAree                                       */
/* ------------------------------------------------------------------ */

interface GestioneAreeProps {
  areas: Area[]
  users: User[]
}

export default function GestioneAree({ areas: initialAreas, users: initialUsers }: GestioneAreeProps) {
  const [areas, setAreas] = useState<Area[]>(initialAreas)
  const [users, setUsers] = useState<User[]>(initialUsers)

  const [showNuovaModal, setShowNuovaModal] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [drawerArea, setDrawerArea] = useState<Area | null>(null)
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  /* Only users with ruolo === 'manager' are valid manager candidates */
  const managers = users.filter((u) => u.ruolo === 'manager')

  /* Count users per area */
  const usersPerArea = useCallback(
    (areaId: string) => users.filter((u) => u.area_id === areaId && u.ruolo !== 'admin').length,
    [users]
  )

  /* Manager name for an area */
  function managerName(managerId: string | null): string {
    if (!managerId) return 'Nessun manager'
    const m = users.find((u) => u.id === managerId)
    return m?.nome ?? 'Manager sconosciuto'
  }

  /* Handlers */
  function handleCreated(area: Area) {
    setAreas((prev) => [...prev, area].sort((a, b) => a.nome.localeCompare(b.nome)))
    setShowNuovaModal(false)
  }

  function handleUpdated(area: Area) {
    setAreas((prev) => prev.map((a) => (a.id === area.id ? area : a)))
    setEditingArea(null)
  }

  function handleUserMoved(userId: string, newAreaId: string) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, area_id: newAreaId } : u)))
    // Update the drawer area reference so the drawer re-renders with fresh data
    if (drawerArea) {
      setDrawerArea((prev) => prev ? { ...prev } : null)
    }
  }

  async function handleDelete(areaId: string) {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/areas/${areaId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Errore ${res.status}`)
      setAreas((prev) => prev.filter((a) => a.id !== areaId))
      setDeletingAreaId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Errore durante l\'eliminazione')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <>
      {/* ---- Page header ---- */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestione aree</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configura le aree operative e assegna i dipendenti
          </p>
        </div>
        <button
          onClick={() => setShowNuovaModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Crea nuova area"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuova area
        </button>
      </div>

      {/* ---- Areas list ---- */}
      {areas.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <p className="text-sm text-gray-500">Nessuna area configurata.</p>
          <button
            onClick={() => setShowNuovaModal(true)}
            className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
          >
            Crea la prima area
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {areas.map((area) => {
            const dipCount = usersPerArea(area.id)
            const isDefault = area.nome === 'Default'

            return (
              <article
                key={area.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4"
                aria-label={`Area ${area.nome}`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 truncate">{area.nome}</h2>
                    <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${SCHEDULING_MODE_COLORS[area.scheduling_mode]}`}>
                      {SCHEDULING_MODE_LABELS[area.scheduling_mode]}
                    </span>
                  </div>
                  {isDefault && (
                    <span className="shrink-0 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                </div>

                {/* Card info */}
                <dl className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                    </svg>
                    <dt className="sr-only">Lavoratori per giorno</dt>
                    <dd>{area.workers_per_day} lavorator{area.workers_per_day === 1 ? 'e' : 'i'} per giorno</dd>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <dt className="sr-only">Manager</dt>
                    <dd className="truncate">{managerName(area.manager_id)}</dd>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <dt className="sr-only">Dipendenti</dt>
                    <dd>{dipCount} dipendent{dipCount === 1 ? 'e' : 'i'}</dd>
                  </div>
                </dl>

                {/* Card actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-auto">
                  <button
                    onClick={() => setDrawerArea(area)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label={`Vedi dipendenti dell'area ${area.nome}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Dipendenti
                  </button>
                  <button
                    onClick={() => setEditingArea(area)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                    aria-label={`Modifica area ${area.nome}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modifica
                  </button>
                  <button
                    onClick={() => { setDeletingAreaId(area.id); setDeleteError(null) }}
                    disabled={isDefault}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                    aria-label={isDefault ? 'L\'area Default non può essere eliminata' : `Elimina area ${area.nome}`}
                    title={isDefault ? 'L\'area Default non può essere eliminata' : undefined}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Elimina
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ---- Delete confirmation modal ---- */}
      {deletingAreaId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-title"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <h2 id="modal-delete-title" className="text-base font-semibold text-gray-900">
                Conferma eliminazione
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              Sei sicuro di voler eliminare l&apos;area{' '}
              <strong>{areas.find((a) => a.id === deletingAreaId)?.nome}</strong>?
              Questa azione non può essere annullata.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setDeletingAreaId(null); setDeleteError(null) }}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(deletingAreaId)}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {deleteLoading && <Spinner />}
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Modals ---- */}
      {showNuovaModal && (
        <NuovaAreaModal
          onClose={() => setShowNuovaModal(false)}
          onCreated={handleCreated}
        />
      )}

      {editingArea && (
        <ModificaAreaModal
          area={editingArea}
          areas={areas}
          managers={managers}
          onClose={() => setEditingArea(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* ---- Drawer ---- */}
      {drawerArea && (
        <DipendentiDrawer
          area={drawerArea}
          allAreas={areas}
          allUsers={users}
          onClose={() => setDrawerArea(null)}
          onUserMoved={handleUserMoved}
        />
      )}
    </>
  )
}
