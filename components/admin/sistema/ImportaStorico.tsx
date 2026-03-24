'use client'

import { useState, useRef, DragEvent } from 'react'

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

interface ImportResult {
  month: number
  year: number
  imported: number
  skipped: number
  unmatched: string[]
  ambiguous: string[]
  pendingShifts: Record<string, { date: string; shift_type: string; reperibile_order: 1 | 2 }[]>
}

interface FileEntry {
  id: number
  file: File
}

interface FileResult {
  id: number
  fileName: string
  result?: ImportResult
  error?: string
}

interface CreateModalState {
  fileResultId: number
  cognome: string
  pendingShifts: { date: string; shift_type: string; reperibile_order: 1 | 2 }[]
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function ImportaStorico() {
  const [selectedFiles, setSelectedFiles] = useState<FileEntry[]>([])
  const [importing, setImporting] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [results, setResults] = useState<FileResult[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [createModal, setCreateModal] = useState<CreateModalState | null>(null)
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(0)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const valid: FileEntry[] = []
    const invalid: string[] = []
    for (const f of Array.from(fileList)) {
      if (f.name.endsWith('.xlsx')) valid.push({ id: nextId.current++, file: f })
      else invalid.push(f.name)
    }
    if (invalid.length > 0) {
      setErrorMsg(`File non validi (solo .xlsx): ${invalid.join(', ')}`)
    } else {
      setErrorMsg(null)
    }
    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid])
      setResults([])
    }
  }

  function removeFile(id: number) {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  async function handleImport() {
    if (selectedFiles.length === 0) return
    setImporting(true)
    setErrorMsg(null)
    setResults([])
    setResolved(new Set())

    const fileResults: FileResult[] = []

    for (const entry of selectedFiles) {
      setCurrentId(entry.id)
      try {
        const formData = new FormData()
        formData.append('file', entry.file)

        const res = await fetch('/api/import-shifts', {
          method: 'POST',
          body: formData,
        })

        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          fileResults.push({ id: entry.id, fileName: entry.file.name, error: json.error ?? 'Errore durante l\'importazione.' })
        } else {
          fileResults.push({ id: entry.id, fileName: entry.file.name, result: json as ImportResult })
        }
      } catch {
        fileResults.push({ id: entry.id, fileName: entry.file.name, error: 'Errore di rete.' })
      }
    }

    setResults(fileResults)
    setSelectedFiles([])
    setCurrentId(null)
    setImporting(false)
  }

  function handleCreated(cognome: string) {
    setResolved((prev) => new Set([...prev, cognome]))
    setCreateModal(null)
  }

  function handleReset() {
    setResults([])
    setSelectedFiles([])
    setResolved(new Set())
    setErrorMsg(null)
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">Importa storico reperibilità</h2>
      <p className="text-sm text-gray-500 mb-5">
        Carica uno o più file Excel con il formato del template per importare turni passati
      </p>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Area di caricamento file. Trascina i file .xlsx o premi Invio per selezionarli"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3
          cursor-pointer transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-400
          ${dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }
        `}
      >
        <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${dragging ? 'bg-blue-100' : 'bg-gray-100'}`} aria-hidden="true">
          <svg className={`w-6 h-6 ${dragging ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </span>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            Trascina i file qui o <span className="text-blue-600">seleziona dal computer</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Solo file .xlsx — puoi selezionarne più di uno</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Lista file selezionati */}
      {selectedFiles.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {selectedFiles.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl">
              <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{entry.file.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatBytes(entry.file.size)}</span>
              {!importing && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(entry.id) }}
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label={`Rimuovi ${entry.file.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {importing && currentId === entry.id && (
                <svg className="w-4 h-4 animate-spin text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messaggio errore selezione */}
      {errorMsg && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Risultati importazione */}
      {results.length > 0 && (
        <div className="mt-3 space-y-3" role="status">
          {results.map((fr) => (
            <div key={fr.fileName}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{fr.fileName}</p>
              {fr.error ? (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fr.error}
                </div>
              ) : fr.result && (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2.5">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      Importati <strong>{fr.result.imported}</strong> turni —{' '}
                      <strong>{MONTH_NAMES_IT[fr.result.month - 1]} {fr.result.year}</strong> —{' '}
                      {(() => {
                        const now = new Date()
                        const isPast = fr.result.year < now.getFullYear() ||
                          (fr.result.year === now.getFullYear() && fr.result.month < now.getMonth() + 1)
                        return isPast ? 'Confermato' : 'Bloccato'
                      })()}
                    </span>
                  </div>
                  {fr.result.skipped > 0 && (
                    <p className="text-sm text-gray-500 px-4">
                      {fr.result.skipped} {fr.result.skipped === 1 ? 'turno già presente, saltato' : 'turni già presenti, saltati'}
                    </p>
                  )}
                  {fr.result.unmatched.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-2.5">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium">Nomi non riconosciuti — puoi creare i dipendenti mancanti:</p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          {fr.result.unmatched.map((cognome) =>
                            resolved.has(cognome) ? (
                              <span
                                key={cognome}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium w-fit"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                {cognome} — creato
                              </span>
                            ) : (
                              <div key={cognome} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-amber-800 bg-amber-100 rounded-full px-2.5 py-1">
                                  {cognome}
                                </span>
                                <button
                                  onClick={() => setCreateModal({
                                    fileResultId: fr.id,
                                    cognome,
                                    pendingShifts: fr.result!.pendingShifts[cognome] ?? [],
                                  })}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                                >
                                  + Crea dipendente
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {fr.result.ambiguous.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-2.5">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium">Nomi ambigui — più dipendenti con stesso cognome (ignorati):</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {fr.result.ambiguous.map((name) => (
                            <span key={name} className="inline-block px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pulsante import / completato */}
      <div className="mt-4 flex items-center gap-3">
        {results.length > 0 && !importing ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Importazione completata
            </span>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200
                hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Nuova importazione
            </button>
          </>
        ) : (
          <button
            onClick={handleImport}
            disabled={selectedFiles.length === 0 || importing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-busy={importing}
          >
            {importing && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {importing
              ? `Importazione ${selectedFiles.find(e => e.id === currentId)?.file.name ?? ''}...`
              : selectedFiles.length > 1
                ? `Importa ${selectedFiles.length} file`
                : 'Importa turni'
            }
          </button>
        )}
      </div>

      {/* Modal creazione dipendente */}
      {createModal && (
        <CreaUtenteModal
          cognome={createModal.cognome}
          pendingShifts={createModal.pendingShifts}
          onClose={() => setCreateModal(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal: crea dipendente e importa i suoi turni in sospeso            */
/* ------------------------------------------------------------------ */

interface CreaUtenteModalProps {
  cognome: string
  pendingShifts: { date: string; shift_type: string; reperibile_order: 1 | 2 }[]
  onClose: () => void
  onCreated: (cognome: string) => void
}

function CreaUtenteModal({ cognome, pendingShifts, onClose, onCreated }: CreaUtenteModalProps) {
  const [nome, setNome] = useState(cognome)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !email.trim()) {
      setError('Compila tutti i campi.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // 1. Crea utente
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), email: email.trim(), ruolo: 'dipendente' }),
      })
      const userJson = await userRes.json().catch(() => ({}))
      if (!userRes.ok) throw new Error(userJson.error ?? 'Errore creazione utente')

      // 2. Inserisci i turni in sospeso (se presenti)
      if (pendingShifts.length > 0) {
        const resolveRes = await fetch('/api/import-shifts/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userJson.id, user_nome: userJson.nome, shifts: pendingShifts }),
        })
        const resolveJson = await resolveRes.json().catch(() => ({}))
        if (!resolveRes.ok) throw new Error(resolveJson.error ?? 'Errore inserimento turni')
      }

      onCreated(cognome)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 id="modal-title" className="text-base font-semibold text-gray-900">
              Crea dipendente
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Cognome rilevato dal file: <strong className="text-gray-700">{cognome}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Chiudi"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info turni in sospeso */}
        {pendingShifts.length > 0 ? (
          <div className="mb-5 flex items-start gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3.5 py-2.5">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Verranno importati <strong>{pendingShifts.length}</strong>{' '}
              {pendingShifts.length === 1 ? 'turno storico' : 'turni storici'} per questo dipendente.
            </span>
          </div>
        ) : (
          <div className="mb-5 flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3.5 py-2.5">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Nessun turno da importare per questo dipendente.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="modal-nome" className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome completo
              </label>
              <input
                id="modal-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Mario Rossi"
                disabled={saving}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900
                  placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400
                  disabled:opacity-60 disabled:bg-gray-50 transition"
              />
            </div>
            <div>
              <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="modal-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dipendente@esempio.it"
                disabled={saving}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900
                  placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400
                  disabled:opacity-60 disabled:bg-gray-50 transition"
              />
            </div>
          </div>

          {/* Errore */}
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5" role="alert">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600
                hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white
                text-sm font-medium hover:bg-blue-700 transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-400
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {saving ? 'Salvataggio...' : 'Crea dipendente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
