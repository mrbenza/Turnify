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

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

const SHIFT_TYPE_CONFIG: Record<string, { label: string; color: string; bar: string }> = {
  weekend:      { label: 'Weekend',      color: 'bg-blue-50 text-blue-700',   bar: 'bg-blue-400'   },
  festivo:      { label: 'Festivo',      color: 'bg-orange-50 text-orange-700', bar: 'bg-orange-400' },
  reperibilita: { label: 'Reperibilità', color: 'bg-purple-50 text-purple-700', bar: 'bg-purple-400' },
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
  distribution: { type: string; count: number }[]
  rows: { date: string; shiftType: string; userName: string }[]
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DAY_ABBR[dt.getDay()]} ${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`
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
      const supabase = createClient()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const to   = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

      const { data: rawShifts, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })

      if (error) throw error

      const shifts = rawShifts ?? []
      const rows = shifts.map((s) => ({
        date: s.date,
        shiftType: s.shift_type,
        userName: userMap.get(s.user_id) ?? s.user_id,
      }))

      const uniqueUsers = new Set(shifts.map((s) => s.user_id)).size

      const counts: Record<string, number> = {}
      for (const s of shifts) counts[s.shift_type] = (counts[s.shift_type] ?? 0) + 1
      const distribution = Object.entries(counts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)

      setPreview({ totalShifts: shifts.length, uniqueUsers, distribution, rows })
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

  /* ---- Export XLSX ---- */
  async function handleExport() {
    setExporting(true)
    setErrorMsg(null)
    try {
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

  const stepNum = templates.length > 1 ? { period: 1, template: 2, preview: 3, send: 4 } : { period: 1, template: 0, preview: 2, send: 3 }

  return (
    <div className="space-y-8">

      {/* Step 1: Periodo */}
      <section aria-labelledby="step-period-heading">
        <h2 id="step-period-heading" className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">{stepNum.period}</span>
          Seleziona il periodo
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterMonth}
            onChange={(e) => handleFilterChange(Number(e.target.value), filterYear)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Mese"
          >
            {MONTH_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={(e) => handleFilterChange(filterMonth, Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Anno"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </section>

      {/* Template selector — only when multiple */}
      {templates.length > 1 && (
        <section aria-labelledby="step-template-heading">
          <h2 id="step-template-heading" className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">{stepNum.template}</span>
            Seleziona template
          </h2>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Template"
          >
            {templates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </section>
      )}

      {/* Step 2: Anteprima */}
      <section aria-labelledby="step-preview-heading">
        <h2 id="step-preview-heading" className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">{stepNum.preview}</span>
          Anteprima turni
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
          <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
            <Spinner /> Caricamento...
          </div>
        )}

        {preview && (
          <div className="space-y-5">

            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-blue-600 w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs text-blue-500 font-medium">{MONTH_NAMES[filterMonth]}</p>
                  <p className="text-sm font-bold text-blue-700">{filterYear}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Turni</p>
                  <p className="text-2xl font-bold text-gray-900 leading-none">{preview.totalShifts}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Dipendenti</p>
                  <p className="text-2xl font-bold text-gray-900 leading-none">{preview.uniqueUsers}</p>
                </div>
              </div>
            </div>

            {preview.totalShifts === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Nessun turno assegnato per il periodo selezionato.</p>
            ) : (
              <>
                {/* Distribution bars */}
                {preview.distribution.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Distribuzione per tipo</p>
                    {preview.distribution.map(({ type, count }) => {
                      const cfg = SHIFT_TYPE_CONFIG[type] ?? { label: type, color: 'bg-gray-100 text-gray-600', bar: 'bg-gray-400' }
                      const pct = preview.totalShifts > 0 ? Math.round((count / preview.totalShifts) * 100) : 0
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <span className={`w-20 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full text-center ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right shrink-0">
                            {count} <span className="text-gray-400">({pct}%)</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Shift list */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dettaglio turni</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {preview.rows.map((row, i) => {
                      const cfg = SHIFT_TYPE_CONFIG[row.shiftType] ?? { label: row.shiftType, color: 'bg-gray-100 text-gray-600' }
                      return (
                        <div key={i} className="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                          <span className="text-xs text-gray-400 font-mono w-20 shrink-0">{formatShortDate(row.date)}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-sm text-gray-700 font-medium truncate">{row.userName}</span>
                        </div>
                      )
                    })}
                  </div>
                  {preview.rows.length > 8 && (
                    <p className="text-xs text-gray-400 mt-2 text-right">{preview.rows.length} turni totali</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Error */}
      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5" role="alert">{errorMsg}</p>
      )}

      {/* Step 3: Genera e scarica */}
      <section aria-labelledby="step-send-heading">
        <h2 id="step-send-heading" className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">{stepNum.send}</span>
          Genera ed invia
        </h2>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <span className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {MONTH_NAMES[filterMonth]} {filterYear}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Genera il file Excel dal template aziendale — formattazione, logo e struttura originali preservati.
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label={`Genera Excel turni ${MONTH_NAMES[filterMonth]} ${filterYear}`}
              >
                {exporting ? <Spinner /> : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {exporting ? 'Generazione in corso...' : 'Genera Excel'}
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
