'use client'

import { useState, useId } from 'react'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface EmailSetting {
  id: string
  email: string
  descrizione: string | null
  attivo: boolean
  created_at: string
}

/* ------------------------------------------------------------------ */
/* Spinner                                                             */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Toggle switch                                                       */
/* ------------------------------------------------------------------ */

interface ToggleSwitchProps {
  checked: boolean
  onChange: () => void
  loading: boolean
  label: string
}

function ToggleSwitch({ checked, onChange, loading, label }: ToggleSwitchProps) {
  if (loading) {
    return <span className="text-gray-400"><Spinner /></span>
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
        checked ? 'bg-green-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
        aria-hidden="true"
      />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Email card                                                          */
/* ------------------------------------------------------------------ */

interface EmailCardProps {
  setting: EmailSetting
  onToggle: (id: string, current: boolean) => void
  onDelete: (id: string) => void
  toggling: boolean
  deleting: boolean
}

function EmailCard({ setting, onToggle, onDelete, toggling, deleting }: EmailCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
      {/* Email icon + info */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span
          className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"
          aria-hidden="true"
        >
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{setting.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {setting.descrizione ?? <em>nessuna descrizione</em>}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 shrink-0 pl-11 sm:pl-0">
        {/* Toggle + label */}
        <div className="flex items-center gap-2">
          <ToggleSwitch
            checked={setting.attivo}
            onChange={() => onToggle(setting.id, setting.attivo)}
            loading={toggling}
            label={`${setting.attivo ? 'Disattiva' : 'Attiva'} ${setting.email}`}
          />
          <span className={`text-xs ${setting.attivo ? 'text-green-600' : 'text-gray-400'}`}>
            {setting.attivo ? 'Attivo' : 'Disattivo'}
          </span>
        </div>

        {/* Delete / confirm */}
        {confirmDelete ? (
          <div className="flex items-center gap-1.5" role="group" aria-label="Conferma eliminazione">
            <span className="text-xs text-gray-500 hidden sm:inline">Sicuro?</span>
            <button
              type="button"
              onClick={() => { onDelete(setting.id); setConfirmDelete(false) }}
              disabled={deleting}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label={`Conferma eliminazione di ${setting.email}`}
            >
              {deleting ? <Spinner /> : null}
              Sì, elimina
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Annulla
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-500 border border-red-100 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
            aria-label={`Elimina indirizzo ${setting.email}`}
          >
            Elimina
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add form (inline, not modal)                                        */
/* ------------------------------------------------------------------ */

interface AddFormProps {
  onAdd: (setting: EmailSetting) => void
  onCancel: () => void
}

function AddForm({ onAdd, onCancel }: AddFormProps) {
  const emailId = useId()
  const descId = useId()

  const [email, setEmail] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("L'indirizzo email è obbligatorio.")
      return
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Inserisci un indirizzo email valido.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, descrizione: descrizione.trim() || undefined }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      const data = await res.json() as EmailSetting
      onAdd(data)
    } catch (err) {
      console.error('Errore inserimento email:', err)
      setError("Errore durante il salvataggio. Verifica che l'indirizzo non sia già presente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Aggiungi indirizzo email"
      className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3"
    >
      <p className="text-sm font-medium text-gray-700">Nuovo indirizzo email</p>

      {/* Email field */}
      <div>
        <label htmlFor={emailId} className="block text-xs font-medium text-gray-600 mb-1">
          Indirizzo email <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          placeholder="lista@azienda.it"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-300"
        />
      </div>

      {/* Description field */}
      <div>
        <label htmlFor={descId} className="block text-xs font-medium text-gray-600 mb-1">
          Descrizione <span className="text-gray-400 font-normal">(opzionale)</span>
        </label>
        <input
          id={descId}
          type="text"
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          placeholder="es. Lista distribuzione team"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-300"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {saving && <Spinner />}
          {saving ? 'Salvataggio...' : 'Salva'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          Annulla
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

interface GestioneEmailProps {
  initialSettings: EmailSetting[]
}

export default function GestioneEmail({ initialSettings }: GestioneEmailProps) {
  const [settings, setSettings] = useState<EmailSetting[]>(initialSettings)
  const [showAddForm, setShowAddForm] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /* ---- Toggle active ---- */
  async function handleToggle(id: string, currentValue: boolean) {
    setToggling(id)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/email-settings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attivo: !currentValue }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      setSettings((prev) =>
        prev.map((s) => (s.id === id ? { ...s, attivo: !currentValue } : s))
      )
    } catch (err) {
      console.error('Errore toggle email:', err)
      setErrorMsg("Errore durante l'aggiornamento. Riprova.")
    } finally {
      setToggling(null)
    }
  }

  /* ---- Delete ---- */
  async function handleDelete(id: string) {
    setDeleting(id)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/email-settings/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Errore sconosciuto')
      }
      setSettings((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Errore eliminazione email:', err)
      setErrorMsg("Errore durante l'eliminazione. Riprova.")
    } finally {
      setDeleting(null)
    }
  }

  /* ---- Add ---- */
  function handleAdd(newSetting: EmailSetting) {
    setSettings((prev) => [...prev, newSetting])
    setShowAddForm(false)
  }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Indirizzi email notifiche
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Questi indirizzi ricevono l&apos;email quando un mese viene confermato.
          </p>
        </div>

        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
            aria-label="Aggiungi indirizzo email"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Aggiungi indirizzo
          </button>
        )}
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <AddForm
          onAdd={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Global error */}
      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Email list */}
      {settings.length === 0 ? (
        <div className="py-10 text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3" aria-hidden="true">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </span>
          <p className="text-sm text-gray-500">Nessun indirizzo email configurato.</p>
          <p className="text-xs text-gray-400 mt-1">
            Aggiungi un indirizzo per ricevere le notifiche dei mesi confermati.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Lista indirizzi email notifiche">
          {settings.map((setting) => (
            <li key={setting.id}>
              <EmailCard
                setting={setting}
                onToggle={handleToggle}
                onDelete={handleDelete}
                toggling={toggling === setting.id}
                deleting={deleting === setting.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
