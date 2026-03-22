'use client'

import { useState, useRef, DragEvent } from 'react'
import type { TemplateFile } from '@/app/admin/sistema/page'

interface GestioneTemplateProps {
  initialTemplates: TemplateFile[]
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function GestioneTemplate({ initialTemplates }: GestioneTemplateProps) {
  const [templates, setTemplates] = useState<TemplateFile[]>(initialTemplates)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
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
    setSuccessMsg(null)
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

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/templates', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error ?? 'Errore durante il caricamento.')
      }

      const newTemplate: TemplateFile = { name: json.name, updated_at: new Date().toISOString() }
      setTemplates((prev) => {
        const exists = prev.find((t) => t.name === json.name)
        if (exists) return prev.map((t) => t.name === json.name ? newTemplate : t)
        return [...prev, newTemplate]
      })
      setSuccessMsg(`Template "${json.name}" caricato con successo.`)
      setSelectedFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      console.error('Errore upload template:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante il caricamento.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">Template Excel</h2>
      <p className="text-sm text-gray-500 mb-5">
        Carica i file .xlsx usati per l&apos;export mensile. Il nome del file diventa il nome del template.
      </p>

      {/* Lista template esistenti */}
      {templates.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Template caricati</p>
          {templates.map((t) => (
            <div key={t.name} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
              <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                <p className="text-xs text-gray-400">
                  {[formatBytes(t.size ?? undefined), formatDate(t.updated_at ?? undefined)].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {templates.length === 0 && (
        <div className="mb-5 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-xl px-3 py-2.5">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Nessun template caricato — l&apos;export non sarà disponibile.
        </div>
      )}

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
            <p className="text-xs text-gray-400 mt-1">Solo file .xlsx — il nome del file verrà mantenuto</p>
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

      {successMsg && (
        <p className="mt-3 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2.5" role="status">
          {successMsg}
        </p>
      )}
      {errorMsg && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      <div className="mt-4">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium
            hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-busy={uploading}
        >
          {uploading && (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {uploading ? 'Caricamento...' : 'Carica template'}
        </button>
      </div>
    </div>
  )
}
