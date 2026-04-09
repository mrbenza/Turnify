'use client'

import { useMemo, useState } from 'react'
import type { User, UserRole, Area } from '@/lib/supabase/types'
import Select from '@/components/ui/Select'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-50 text-purple-700',
  manager: 'bg-blue-50 text-blue-700',
  dipendente: 'bg-gray-50 text-gray-600',
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(iso: string | null): string {
  if (!iso) return 'Mai'
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function inactivityLabel(disattivatoAt: string | null): { label: string; isOld: boolean } {
  if (!disattivatoAt) return { label: '', isOld: false }
  const ms = Date.now() - new Date(disattivatoAt).getTime()
  const days = Math.floor(ms / 86400000)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)
  const isOld = days >= 365
  let label: string
  if (years >= 1) label = `${years} ${years === 1 ? 'anno' : 'anni'}`
  else if (months >= 1) label = `${months} ${months === 1 ? 'mese' : 'mesi'}`
  else label = `${days} ${days === 1 ? 'giorno' : 'giorni'}`
  return { label, isOld }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface ListaUtentiProps {
  initialUsers: User[]
  currentUserId: string
  lastLogins: { id: string; last_sign_in_at: string | null }[]
  isManager?: boolean
  areas?: Area[]
}

type SortKey = 'nome' | 'email' | 'ruolo' | 'area' | 'last_login' | 'attivo'
type SortDirection = 'asc' | 'desc'

export default function ListaUtenti({ initialUsers, currentUserId, lastLogins, isManager = false, areas = [] }: ListaUtentiProps) {
  const [dipendentes, setUsers] = useState<User[]>(initialUsers)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterAreaId, setFilterAreaId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('nome')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const areaMap = new Map<string, string>(areas.map((a) => [a.id, a.nome]))
  const isAdmin = areas.length > 0

  /* Build a fast lookup map for last logins */
  const lastLoginMap = new Map<string, string | null>(
    lastLogins.map(({ id, last_sign_in_at }) => [id, last_sign_in_at])
  )

  const filtered = useMemo(() => dipendentes.filter((u) => {
    if (filterAreaId && u.area_id !== filterAreaId) return false
    if (searchQuery && !u.nome.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  }), [dipendentes, filterAreaId, searchQuery])

  const sorted = useMemo(() => {
    const roleOrder: Record<UserRole, number> = {
      admin: 0,
      manager: 1,
      dipendente: 2,
    }

    const direction = sortDirection === 'asc' ? 1 : -1
    const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true })

    return [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortKey) {
        case 'nome':
          comparison = collator.compare(a.nome, b.nome)
          break
        case 'email':
          comparison = collator.compare(a.email, b.email)
          break
        case 'ruolo':
          comparison = roleOrder[a.ruolo] - roleOrder[b.ruolo]
          if (comparison === 0) comparison = collator.compare(a.nome, b.nome)
          break
        case 'area': {
          const areaA = areaMap.get(a.area_id) ?? ''
          const areaB = areaMap.get(b.area_id) ?? ''
          comparison = collator.compare(areaA, areaB)
          if (comparison === 0) comparison = collator.compare(a.nome, b.nome)
          break
        }
        case 'last_login': {
          const loginA = lastLoginMap.get(a.id)
          const loginB = lastLoginMap.get(b.id)
          const timeA = loginA ? new Date(loginA).getTime() : -1
          const timeB = loginB ? new Date(loginB).getTime() : -1
          comparison = timeA - timeB
          if (comparison === 0) comparison = collator.compare(a.nome, b.nome)
          break
        }
        case 'attivo':
          comparison = Number(a.attivo) - Number(b.attivo)
          if (comparison === 0) comparison = collator.compare(a.nome, b.nome)
          break
      }

      return comparison * direction
    })
  }, [areaMap, filtered, lastLoginMap, sortDirection, sortKey])

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection('asc')
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  /* ---- Toggle active/inactive ---- */
  async function handleToggleActive(dipendente: User) {
    setToggling(dipendente.id)
    setErrorMsg(null)
    try {
      const newValue = !dipendente.attivo
      const res = await fetch(`/api/users/${dipendente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attivo: newValue }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      setUsers((prev) => prev.map((u) => u.id === dipendente.id ? { ...u, attivo: newValue } : u))
    } catch (err) {
      console.error('Errore toggle utente:', err)
      setErrorMsg('Errore durante l\'aggiornamento dell\'utente.')
    } finally {
      setToggling(null)
    }
  }

  /* ---- Change role inline ---- */
  async function handleRoleChange(dipendente: User, newRole: UserRole) {
    setChangingRole(dipendente.id)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/users/${dipendente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruolo: newRole }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      setUsers((prev) => prev.map((u) => u.id === dipendente.id ? { ...u, ruolo: newRole } : u))
    } catch (err) {
      console.error('Errore cambio ruolo:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante il cambio ruolo.')
    } finally {
      setChangingRole(null)
    }
  }

  /* ---- Delete dipendente ---- */
  async function handleDelete(dipendente: User) {
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${dipendente.nome}"? Questa azione è irreversibile.`)) return
    setDeleting(dipendente.id)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/users/${dipendente.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      setUsers((prev) => prev.filter((u) => u.id !== dipendente.id))
    } catch (err) {
      console.error('Errore eliminazione utente:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante l\'eliminazione dell\'utente.')
    } finally {
      setDeleting(null)
    }
  }

  const Spinner = () => (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )

  return (
    <div>
      {/* Header actions */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Aggiungi nuovo utente"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi utente
        </button>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-2 mb-5">
        {isAdmin && areas.length > 1 && (
          <Select
            value={filterAreaId ?? ''}
            onChange={(v) => setFilterAreaId(v || null)}
            options={[
              { value: '', label: 'Tutte le aree' },
              ...areas.map((area) => ({ value: area.id, label: area.nome })),
            ]}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Filtra per area"
          />
        )}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per nome…"
            aria-label="Cerca utente per nome"
            className="text-sm border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
          />
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">Nessun utente trovato.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm" aria-label="Lista utenti">
            <thead>
              <tr className="border-b border-gray-100">
                <th scope="col" className="text-left py-2.5 px-4 sm:px-0 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  <button type="button" onClick={() => handleSort('nome')} className="inline-flex items-center gap-1 hover:text-gray-700">
                    Nome <span aria-hidden="true">{sortIndicator('nome')}</span>
                  </button>
                </th>
                <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">
                  <button type="button" onClick={() => handleSort('email')} className="inline-flex items-center gap-1 hover:text-gray-700">
                    Email <span aria-hidden="true">{sortIndicator('email')}</span>
                  </button>
                </th>
                <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  <button type="button" onClick={() => handleSort('ruolo')} className="inline-flex items-center gap-1 hover:text-gray-700">
                    Ruolo <span aria-hidden="true">{sortIndicator('ruolo')}</span>
                  </button>
                </th>
                {isAdmin && (
                  <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">
                    <button type="button" onClick={() => handleSort('area')} className="inline-flex items-center gap-1 hover:text-gray-700">
                      Area <span aria-hidden="true">{sortIndicator('area')}</span>
                    </button>
                  </th>
                )}
                <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">
                  <button type="button" onClick={() => handleSort('last_login')} className="inline-flex items-center gap-1 hover:text-gray-700">
                    Ultimo login <span aria-hidden="true">{sortIndicator('last_login')}</span>
                  </button>
                </th>
                <th scope="col" className="text-left py-2.5 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  <button type="button" onClick={() => handleSort('attivo')} className="inline-flex items-center gap-1 hover:text-gray-700">
                    Attivo <span aria-hidden="true">{sortIndicator('attivo')}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((dipendente) => (
                <tr key={dipendente.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 sm:px-0">
                    <div className="font-medium text-gray-800">{dipendente.nome}</div>
                    <div className="text-xs text-gray-400 sm:hidden">{dipendente.email}</div>
                  </td>
                  <td className="py-3 px-4 sm:px-2 text-gray-500 hidden sm:table-cell">{dipendente.email}</td>
                  <td className="py-3 px-4 sm:px-2">
                    {isManager ? (
                      /* Manager: ruolo non modificabile — solo badge statico */
                      <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${ROLE_STYLES[dipendente.ruolo]}`}>
                        {dipendente.ruolo === 'dipendente' ? 'ATC' : dipendente.ruolo === 'manager' ? 'Area Manager' : 'Administrator'}
                      </span>
                    ) : changingRole === dipendente.id ? (
                      <span className="text-gray-400"><Spinner /></span>
                    ) : (
                      <Select
                        value={dipendente.ruolo}
                        onChange={(v) => handleRoleChange(dipendente, v as UserRole)}
                        options={[
                          { value: 'dipendente', label: 'ATC' },
                          { value: 'manager', label: 'Area Manager' },
                          { value: 'admin', label: 'Administrator' },
                        ]}
                        disabled={dipendente.id === currentUserId}
                        aria-label={`Ruolo di ${dipendente.nome}`}
                        title={dipendente.id === currentUserId ? 'Non puoi modificare il tuo ruolo' : undefined}
                        className={`
                          text-xs font-medium rounded-full px-2 py-0.5 border-0 cursor-pointer
                          focus:outline-none focus:ring-2 focus:ring-blue-400
                          ${ROLE_STYLES[dipendente.ruolo]}
                          ${dipendente.id === currentUserId ? 'cursor-not-allowed opacity-60' : ''}
                        `}
                      />
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-4 sm:px-2 text-gray-500 hidden sm:table-cell text-xs">
                      {areaMap.get(dipendente.area_id) ?? '—'}
                    </td>
                  )}
                  <td className="py-3 px-4 sm:px-2 text-gray-500 hidden sm:table-cell text-xs">
                    {formatDate(lastLoginMap.get(dipendente.id) ?? null)}
                  </td>
                  <td className="py-3 px-4 sm:px-2">
                    <div className="flex items-center gap-2">
                      {toggling === dipendente.id ? (
                        <span className="text-gray-400"><Spinner /></span>
                      ) : (
                        <button
                          role="switch"
                          aria-checked={dipendente.attivo}
                          aria-label={`${dipendente.attivo ? 'Disattiva' : 'Attiva'} utente ${dipendente.nome}`}
                          title={dipendente.id === currentUserId ? 'Non puoi disattivare il tuo account' : undefined}
                          onClick={() => handleToggleActive(dipendente)}
                          disabled={dipendente.id === currentUserId}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                            dipendente.id === currentUserId
                              ? 'cursor-not-allowed opacity-50'
                              : 'cursor-pointer'
                          } ${dipendente.attivo ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                              dipendente.attivo ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                      <span className={`text-xs ${dipendente.attivo ? 'text-green-600' : 'text-gray-400'}`}>
                        {dipendente.attivo ? 'Attivo' : 'Inattivo'}
                      </span>
                      {!isManager && !dipendente.attivo && dipendente.id !== currentUserId && (() => {
                        const { label, isOld } = inactivityLabel(dipendente.disattivato_at)
                        return (
                          <div className="flex flex-col items-start gap-0.5">
                            {label && (
                              <span className={`text-[10px] leading-tight ${isOld ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                                inattivo da {label}
                              </span>
                            )}
                            <button
                              onClick={() => handleDelete(dipendente)}
                              disabled={deleting === dipendente.id}
                              aria-label={`Elimina utente ${dipendente.nome}`}
                              className={`text-xs border rounded px-2 py-0.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isOld
                                  ? 'text-red-600 hover:text-red-800 border-red-300 hover:border-red-500 bg-red-50'
                                  : 'text-red-500 hover:text-red-700 border-red-200 hover:border-red-400'
                              }`}
                            >
                              {deleting === dipendente.id ? '...' : 'Elimina'}
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add dipendente modal */}
      {showAddModal && (
        <AddUserModal
          isManager={isManager}
          areas={areas}
          onClose={() => setShowAddModal(false)}
          onAdded={(newUser) => {
            setUsers((prev) => [...prev, newUser])
            setShowAddModal(false)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add User Modal                                                      */
/* ------------------------------------------------------------------ */

interface AddUserModalProps {
  onClose: () => void
  onAdded: (dipendente: User) => void
  isManager?: boolean
  areas?: Area[]
}

function AddUserModal({ onClose, onAdded, isManager = false, areas = [] }: AddUserModalProps) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [ruolo, setRuolo] = useState<UserRole>('dipendente')
  const [areaId, setAreaId] = useState<string>(areas[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !email.trim()) {
      setError('Compila tutti i campi obbligatori.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), email: email.trim(), ruolo, ...(!isManager && areaId ? { area_id: areaId } : {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      setSuccessMsg('Utente creato. Password temporanea: 1234')
      onAdded(json as User)
    } catch (err) {
      console.error('Errore inserimento utente:', err)
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-dipendente-modal-title"
    >
      <div className="absolute inset-0 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-md w-full z-10">
        <h2 id="add-dipendente-modal-title" className="text-base font-semibold text-gray-900 mb-4">
          Aggiungi utente
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Nome */}
          <div>
            <label htmlFor="add-nome" className="block text-xs font-medium text-gray-700 mb-1">
              Nome completo <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="add-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Mario Rossi"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-300"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="add-email" className="block text-xs font-medium text-gray-700 mb-1">
              Email <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="add-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="mario.rossi@azienda.it"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-300"
            />
          </div>

          {/* Ruolo — manager può creare solo dipendenti */}
          {!isManager && (
            <div>
              <label htmlFor="add-ruolo" className="block text-xs font-medium text-gray-700 mb-1">Ruolo</label>
              <Select
                id="add-ruolo"
                value={ruolo}
                onChange={(v) => setRuolo(v as UserRole)}
                options={[
                  { value: 'dipendente', label: 'ATC' },
                  { value: 'manager', label: 'Area Manager' },
                  { value: 'admin', label: 'Administrator' },
                ]}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          )}

          {/* Area — solo per admin, non per manager (usa sempre la propria) */}
          {!isManager && areas.length > 0 && (
            <div>
              <label htmlFor="add-area" className="block text-xs font-medium text-gray-700 mb-1">Area</label>
              <select
                id="add-area"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2" role="status">{successMsg}</p>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !!successMsg}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 inline-flex items-center justify-center gap-2"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {saving ? 'Salvataggio...' : 'Aggiungi'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
