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

function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function ImportaStorico() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | null) {
    if (!file) return
    if (!file.name.endsWith('.xlsx')) {
      setErrorMsg('Seleziona un file .xlsx valido.')
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
    setErrorMsg(null)
    setResult(null)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  async function handleImport() {
    if (!selectedFile) return
    setImporting(true)
    setErrorMsg(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/import-shifts', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error ?? 'Errore durante l\'importazione.')
      }

      setResult(json as ImportResult)
      setSelectedFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      console.error('Errore import storico:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante l\'importazione.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">Importa storico reperibilità</h2>
      <p className="text-sm text-gray-500 mb-5">
        Carica un file Excel con il formato del template per importare turni passati
      </p>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Area di caricamento file. Trascina un file .xlsx o premi Invio per selezionarlo"
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

        {selectedFile ? (
          <div className="text-center">
            <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatBytes(selectedFile.size)}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              Trascina il file qui o <span className="text-blue-600">seleziona dal computer</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Solo file .xlsx — stesso formato del template export</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Messaggio errore */}
      {errorMsg && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Risultato importazione */}
      {result && (
        <div className="mt-3 space-y-2" role="status">
          {/* Riga principale — successo */}
          <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2.5">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Importati <strong>{result.imported}</strong> turni —{' '}
              Mese: <strong>{MONTH_NAMES_IT[result.month - 1]} {result.year}</strong> — Bloccato
            </span>
          </div>

          {/* Turni saltati */}
          {result.skipped > 0 && (
            <p className="text-sm text-gray-500 px-4">
              {result.skipped} {result.skipped === 1 ? 'turno già presente, saltato' : 'turni già presenti, saltati'}
            </p>
          )}

          {/* Nomi non riconosciuti */}
          {result.unmatched.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-2.5">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Nomi non riconosciuti (ignorati):</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {result.unmatched.map((name) => (
                    <span
                      key={name}
                      className="inline-block px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Nomi ambigui */}
          {result.ambiguous.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-2.5">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Nomi ambigui — più dipendenti con stesso cognome (ignorati):</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {result.ambiguous.map((name) => (
                    <span
                      key={name}
                      className="inline-block px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pulsante import */}
      <div className="mt-4">
        <button
          onClick={handleImport}
          disabled={!selectedFile || importing}
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
          {importing ? 'Importazione...' : 'Importa turni'}
        </button>
      </div>
    </div>
  )
}
