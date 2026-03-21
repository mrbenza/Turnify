'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Shift, User } from '@/lib/supabase/types'

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

const SHIFT_TYPE_LABELS: Record<string, string> = {
  weekend: 'Weekend',
  festivo: 'Festivo',
  reperibilita: 'Reperibilità',
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface TemplateFile {
  name: string
}

interface ExportFormProps {
  users: User[]
  templates: TemplateFile[]
}

interface PreviewData {
  totalShifts: number
  uniqueUsers: number
  rows: { date: string; userName: string; shiftType: string }[]
}

export default function ExportForm({ users, templates }: ExportFormProps) {
  const now = new Date()
  const [filterMonth, setFilterMonth] = useState(now.getMonth())
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templates[0]?.name ?? '')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const userMap = new Map<string, string>(users.map((u) => [u.id, u.nome]))
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  /* ---- Load preview ---- */
  async function loadPreview(month: number, year: number) {
    setLoadingPreview(true)
    setErrorMsg(null)
    setPreview(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

      const { data: rawShifts, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })

      if (error) throw error

      const shifts = (rawShifts ?? []) as Shift[]
      const rows = shifts.map((s) => ({
        date: s.date,
        userName: userMap.get(s.user_id) ?? s.user_id,
        shiftType: SHIFT_TYPE_LABELS[s.shift_type] ?? s.shift_type,
      }))

      const uniqueUsers = new Set(shifts.map((s) => s.user_id)).size

      setPreview({ totalShifts: shifts.length, uniqueUsers, rows })
    } catch (err) {
      console.error('Errore caricamento anteprima:', err)
      setErrorMsg('Impossibile caricare l\'anteprima.')
    } finally {
      setLoadingPreview(false)
    }
  }

  function handleFilterChange(month: number, year: number) {
    setFilterMonth(month)
    setFilterYear(year)
    setPreview(null)
  }

  /* ---- Export XLSX dal template aziendale ---- */
  async function handleExport() {
    setExporting(true)
    setErrorMsg(null)
    try {
      // month API è 1-based
      const templateParam = selectedTemplate ? `&template=${encodeURIComponent(selectedTemplate)}` : ''
      const res = await fetch(`/api/export?month=${filterMonth + 1}&year=${filterYear}${templateParam}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Errore HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `turni_${MONTH_NAMES[filterMonth]}_${filterYear}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Errore export:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante la generazione del file.')
    } finally {
      setExporting(false)
    }
  }

  const Spinner = () => (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )

  return (
    <div className="space-y-6">
      {/* Step 1: Select period */}
      <section aria-labelledby="step1-heading">
        <h2 id="step1-heading" className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">1</span>
          Seleziona il periodo
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterMonth}
            onChange={(e) => handleFilterChange(Number(e.target.value), filterYear)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Mese da esportare"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => handleFilterChange(filterMonth, Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Anno da esportare"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Template selector — visibile solo se ci sono più template */}
      {templates.length > 1 && (
        <section aria-labelledby="template-heading">
          <h2 id="template-heading" className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">2</span>
            Seleziona template
          </h2>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Template da usare per l'export"
          >
            {templates.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </section>
      )}

      {/* Step 2: Preview */}
      <section aria-labelledby="step2-heading">
        <h2 id="step2-heading" className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">2</span>
          Anteprima dati
        </h2>

        {!preview && !loadingPreview && (
          <button
            onClick={() => loadPreview(filterMonth, filterYear)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 text-sm font-medium hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Carica anteprima
          </button>
        )}

        {loadingPreview && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <Spinner /> Caricamento anteprima...
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-500">Turni totali</p>
                <p className="text-2xl font-bold text-gray-900">{preview.totalShifts}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-500">Dipendenti coinvolti</p>
                <p className="text-2xl font-bold text-gray-900">{preview.uniqueUsers}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 col-span-2 sm:col-span-1">
                <p className="text-xs text-gray-500">Periodo</p>
                <p className="text-base font-semibold text-gray-800">{MONTH_NAMES[filterMonth]} {filterYear}</p>
              </div>
            </div>

            {/* Preview table */}
            {preview.rows.length > 0 && (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm" aria-label="Anteprima dati export">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th scope="col" className="text-left py-2 px-4 sm:px-0 font-semibold text-gray-500 text-xs uppercase tracking-wide">Data</th>
                      <th scope="col" className="text-left py-2 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Dipendente</th>
                      <th scope="col" className="text-left py-2 px-4 sm:px-2 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 px-4 sm:px-0 text-gray-700">{row.date}</td>
                        <td className="py-2 px-4 sm:px-2 text-gray-700">{row.userName}</td>
                        <td className="py-2 px-4 sm:px-2 text-gray-500">{row.shiftType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 10 && (
                  <p className="text-xs text-gray-400 mt-2 px-4 sm:px-0">
                    ... e altri {preview.rows.length - 10} turni
                  </p>
                )}
              </div>
            )}

            {preview.rows.length === 0 && (
              <p className="text-sm text-gray-500">Nessun turno per il periodo selezionato.</p>
            )}
          </div>
        )}
      </section>

      {/* Error */}
      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Step 3: Download */}
      <section aria-labelledby="step3-heading">
        <h2 id="step3-heading" className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">3</span>
          Scarica file
        </h2>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-sm text-blue-700">
            Il file generato segue il <strong>template aziendale</strong> con formattazione, colori e struttura originali.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label={`Scarica Excel turni ${MONTH_NAMES[filterMonth]} ${filterYear}`}
          >
            {exporting ? <Spinner /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {exporting ? 'Generazione...' : 'Scarica Excel'}
          </button>
        </div>
      </section>
    </div>
  )
}
