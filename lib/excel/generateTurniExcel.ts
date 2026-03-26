import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

function excelSerial(year: number, month: number, day: number): number {
  const d = Date.UTC(year, month - 1, day)
  const epoch = Date.UTC(1899, 11, 30)
  return Math.round((d - epoch) / 86400000)
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function setNumCell(xml: string, addr: string, value: number): string {
  const re = new RegExp('<c r="' + addr + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)')
  return xml.replace(re, (_match, attrs: string) => {
    const a = attrs.replace(/\s+t="[^"]*"/g, '')
    return `<c r="${addr}"${a}><v>${value}</v></c>`
  })
}

function setInlineStr(xml: string, addr: string, value: string, red = false): string {
  const re = new RegExp('<c r="' + addr + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)')

  const makeCell = (attrs: string): string => {
    const a = attrs.replace(/\s+t="[^"]*"/g, '')
    if (!value) return `<c r="${addr}"${a}/>`
    const t = escXml(value)
    const inner = red
      ? `<is><r><rPr><color rgb="FFFF0000"/></rPr><t>${t}</t></r></is>`
      : `<is><t>${t}</t></is>`
    return `<c r="${addr}"${a} t="inlineStr">${inner}</c>`
  }

  if (re.test(xml)) {
    return xml.replace(re, (_match, attrs: string) => makeCell(attrs))
  }

  if (!value) return xml
  const rowNum = addr.replace(/[A-Z]+/g, '')
  const rowRe = new RegExp('(<row\\b[^>]*\\br="' + rowNum + '"[^>]*>)([\\s\\S]*?)(</row>)')
  return xml.replace(rowRe, (_m, open: string, content: string, close: string) =>
    open + content + makeCell('') + close
  )
}

async function getDatiSheetPath(zip: JSZip): Promise<string | null> {
  const wbFile = zip.files['xl/workbook.xml']
  if (!wbFile) return null
  const wbXml = await wbFile.async('string')
  const shM = wbXml.match(/<sheet\b[^>]*\bname="Dati"[^>]*\br:id="([^"]+)"/)
  if (!shM) return null
  const rId = shM[1]
  const relsFile = zip.files['xl/_rels/workbook.xml.rels']
  if (!relsFile) return null
  const relsXml = await relsFile.async('string')
  const relM = relsXml.match(new RegExp('Id="' + rId + '"[^>]*Target="([^"]+)"'))
  if (!relM) return null
  const target = relM[1]
  return target.startsWith('xl/') ? target : `xl/${target}`
}

export type GenerateResult = {
  buffer: Buffer
  fileName: string
  shiftsByDate: Map<string, string[]>
}

/**
 * Genera il file Excel dei turni per il mese indicato.
 * Richiede il serviceClient per accedere a shifts, users e template storage.
 */
export async function generateTurniExcel(
  month: number,
  year: number,
  serviceClient: SupabaseClient,
  templateName?: string | null,
  areaId?: string,
): Promise<GenerateResult> {
  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  let shiftsQuery = serviceClient.from('shifts').select('date, user_id, reperibile_order').gte('date', from).lte('date', to)
  if (areaId) shiftsQuery = shiftsQuery.eq('area_id', areaId)
  shiftsQuery = shiftsQuery.order('date').order('reperibile_order')

  let usersQuery = serviceClient.from('users').select('id, nome')
  if (areaId) usersQuery = usersQuery.eq('area_id', areaId)

  const [{ data: shifts }, { data: users }] = await Promise.all([
    shiftsQuery,
    usersQuery,
  ])

  const userMap = new Map<string, string>(
    (users ?? []).map((u: { id: string; nome: string }) => {
      const idx = u.nome.indexOf(' ')
      return [u.id, idx === -1 ? u.nome : u.nome.slice(idx + 1)]
    })
  )

  const shiftsByDate = new Map<string, string[]>()
  for (const s of shifts ?? []) {
    if (!shiftsByDate.has(s.date)) shiftsByDate.set(s.date, [])
    shiftsByDate.get(s.date)!.push(userMap.get(s.user_id) ?? s.user_id)
  }

  // Recupera nome area e manager se areaId fornito
  let areaNome: string | null = null
  let managerNome: string | null = null
  if (areaId) {
    const { data: area } = await serviceClient
      .from('areas')
      .select('nome, manager_id')
      .eq('id', areaId)
      .single()
    if (area) {
      areaNome = area.nome
      if (area.manager_id) {
        const { data: manager } = await serviceClient
          .from('users')
          .select('nome')
          .eq('id', area.manager_id)
          .single()
        if (manager) {
          const idx = manager.nome.indexOf(' ')
          managerNome = idx === -1 ? manager.nome : manager.nome.slice(idx + 1)
        }
      }
    }
  }

  // Scarica template dallo storage
  let resolvedTemplate = templateName
  if (!resolvedTemplate) {
    const { data: fileList } = await serviceClient.storage.from('templates').list()
    const xlsxFiles = (fileList ?? []).filter((f: { name: string }) => f.name.endsWith('.xlsx'))
    if (xlsxFiles.length === 0) throw new Error('Nessun template Excel trovato nello storage')
    resolvedTemplate = xlsxFiles[0].name
  }

  const { data: blob, error: storageError } = await serviceClient.storage
    .from('templates').download(resolvedTemplate)
  if (storageError || !blob) throw new Error(`Template "${resolvedTemplate}" non trovato nello storage`)

  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const sheetPath = await getDatiSheetPath(zip)
  if (!sheetPath || !zip.files[sheetPath]) throw new Error('Foglio "Dati" non trovato nel template')

  let sheetXml = await zip.files[sheetPath].async('string')

  // In A1 scrive solo la prima parte del nome (es. "Area4 - Toscana" → "AREA 4")
  if (areaNome) {
    const dashIdx = areaNome.indexOf(' - ')
    const shortName = dashIdx !== -1 ? areaNome.slice(0, dashIdx) : areaNome
    sheetXml = setInlineStr(sheetXml, 'A1', shortName.toUpperCase())
  }
  if (managerNome) sheetXml = setInlineStr(sheetXml, 'C51', managerNome)
  sheetXml = setNumCell(sheetXml, 'A3', excelSerial(year, month, 1))
  const now = new Date()
  sheetXml = setNumCell(sheetXml, 'C5', excelSerial(now.getFullYear(), now.getMonth() + 1, now.getDate()))

  const DATA_START = 10
  for (let day = 1; day <= 31; day++) {
    const row = DATA_START + day - 1
    if (day <= daysInMonth) {
      const dateStr   = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const serial    = excelSerial(year, month, day)
      const dow       = new Date(year, month - 1, day).getDay()
      const isWeekend = dow === 0 || dow === 6
      const names     = shiftsByDate.get(dateStr) ?? []
      sheetXml = setNumCell(sheetXml, `A${row}`, serial)
      sheetXml = setInlineStr(sheetXml, `D${row}`, names[0] ?? '', isWeekend)
      sheetXml = setInlineStr(sheetXml, `E${row}`, names[1] ?? '', isWeekend)
    } else {
      sheetXml = setInlineStr(sheetXml, `D${row}`, '')
      sheetXml = setInlineStr(sheetXml, `E${row}`, '')
    }
  }

  zip.file(sheetPath, sheetXml)
  zip.remove('xl/calcChain.xml')

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const areaShort = areaNome
    ? (areaNome.indexOf(' - ') !== -1 ? areaNome.slice(0, areaNome.indexOf(' - ')) : areaNome).replace(/\s+/g, '')
    : 'turni'
  const fileName = `${areaShort}_${MONTH_NAMES_IT[month - 1]}_${year}.xlsx`

  return { buffer, fileName, shiftsByDate }
}
