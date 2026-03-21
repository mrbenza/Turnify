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
                      <strong>{MONTH_NAMES_IT[fr.result.month - 1]} {fr.result.year}</strong> — Bloccato
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
                        <p className="font-medium">Nomi non riconosciuti (ignorati):</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {fr.result.unmatched.map((name) => (
                            <span key={name} className="inline-block px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
                              {name}
                            </span>
                          ))}
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

      {/* Pulsante import */}
      <div className="mt-4">
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
      </div>
    </div>
  )
}
