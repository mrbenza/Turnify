import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

/** Excel date serial: days elapsed since 1899-12-30 */
function excelSerial(year: number, month: number, day: number): number {
  const d = Date.UTC(year, month - 1, day)
  const epoch = Date.UTC(1899, 11, 30)
  return Math.round((d - epoch) / 86400000)
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Replace a numeric-value cell in sheet XML.
 * Preserves s="..." (style) unless styleOverride is given.
 * Strips any existing t="..." type attribute.
 */
function setNumCell(xml: string, addr: string, value: number, styleOverride?: number): string {
  // NOTE: no backslash before quotes — XML uses plain double-quotes
  const re = new RegExp('<c r="' + addr + '"([^>]*)(?:/>|>[\\s\\S]*?</c>)')
  return xml.replace(re, (_match, attrs: string) => {
    let a = attrs.replace(/\s+t="[^"]*"/g, '')
    if (styleOverride !== undefined) {
      a = a.replace(/\s+s="\d+"/, ` s="${styleOverride}"`)
    }
    return `<c r="${addr}"${a}><v>${value}</v></c>`
  })
}

/**
 * Replace a cell with an inline string (t="inlineStr").
 * Optionally applies red color via rich-text run (no styles.xml change needed).
 * If the cell is absent from the XML and value is non-empty, inserts it into the row.
 */
function setInlineStr(xml: string, addr: string, value: string, red = false): string {
  const re = new RegExp('<c r="' + addr + '"([^>]*)(?:/>|>[\\s\\S]*?</c>)')
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

  // Cell not found — insert into the correct row (only when value is non-empty)
  if (!value) return xml
  const rowNum = addr.replace(/[A-Z]+/g, '')
  const rowRe = new RegExp('(<row\\b[^>]*\\br="' + rowNum + '"[^>]*>)([\\s\\S]*?)(</row>)')
  return xml.replace(rowRe, (_m, open: string, content: string, close: string) =>
    open + content + makeCell('') + close
  )
}

/** Read s="N" attribute from a cell element */
function getCellStyleIdx(xml: string, addr: string): number {
  const m = xml.match(new RegExp('<c r="' + addr + '"[^>]*\\bs="(\\d+)"'))
  return m ? parseInt(m[1]) : 0
}

/**
 * Add a red-font variant of xf[baseIdx] to styles.xml.
 * Returns updated XML and new xf index.
 */
function addRedXf(stylesXml: string, baseIdx: number): { xml: string; idx: number } {
  // --- 1. Add red font ---
  const fntCntM = stylesXml.match(/<fonts count="(\d+)"/)
  const fntCnt = parseInt(fntCntM?.[1] ?? '1')
  const redFontIdx = fntCnt

  stylesXml = stylesXml
    .replace(/<fonts count="\d+"/, `<fonts count="${fntCnt + 1}"`)
    .replace('</fonts>', `<font><color rgb="FFFF0000"/></font></fonts>`)

  // --- 2. Clone xf[baseIdx] with red font ---
  const xfCntM = stylesXml.match(/<cellXfs count="(\d+)"/)
  const xfCnt = parseInt(xfCntM?.[1] ?? '1')
  const newIdx = xfCnt

  const xfSectionM = stylesXml.match(/(<cellXfs[^>]*>)([\s\S]*?)(<\/cellXfs>)/)
  if (!xfSectionM) return { xml: stylesXml, idx: newIdx }

  const xfList: string[] = []
  const xfRe = /<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g
  let m: RegExpExecArray | null
  while ((m = xfRe.exec(xfSectionM[2])) !== null) xfList.push(m[0])

  let base = xfList[baseIdx] ?? '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'

  base = base.includes('fontId=')
    ? base.replace(/fontId="\d+"/, `fontId="${redFontIdx}"`)
    : base.replace('<xf ', `<xf fontId="${redFontIdx}" `)

  base = base.includes('applyFont=')
    ? base.replace(/applyFont="\d+"/, 'applyFont="1"')
    : base.replace('<xf ', '<xf applyFont="1" ')

  // Make the cloned xf self-closing (drop any child elements)
  base = base.replace(/\s*>[\s\S]*$/, '/>')

  stylesXml = stylesXml
    .replace(/<cellXfs count="\d+"/, `<cellXfs count="${xfCnt + 1}"`)
    .replace('</cellXfs>', base + '</cellXfs>')

  return { xml: stylesXml, idx: newIdx }
}

/** Resolve path of the "Dati" worksheet from workbook.xml + workbook.xml.rels */
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

  const target = relM[1] // e.g. "worksheets/sheet1.xml"
  return target.startsWith('xl/') ? target : `xl/${target}`
}

export async function GET(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('ruolo').eq('id', user.id).single()
  if (profile?.ruolo !== 'admin')
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2020 || year > 2100)
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })

  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts').select('date, user_id')
    .gte('date', from).lte('date', to).order('date', { ascending: true })

  if (shiftsError) {
    console.error('Errore fetch turni:', shiftsError)
    return NextResponse.json({ error: 'Errore lettura turni dal database' }, { status: 500 })
  }

  const { data: users } = await supabase.from('users').select('id, nome')
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

  // Download template from Supabase Storage
  const serviceClient = createServiceClient()
  const { data: blob, error: storageError } = await serviceClient.storage
    .from('templates').download('AREA4.xlsx')

  if (storageError || !blob) {
    console.error('Template non trovato:', storageError)
    return NextResponse.json({ error: 'Template Excel non trovato nello storage' }, { status: 500 })
  }

  const templateBuf = await blob.arrayBuffer()
  const zip = await JSZip.loadAsync(templateBuf)

  // Locate "Dati" worksheet
  const sheetPath = await getDatiSheetPath(zip)
  if (!sheetPath || !zip.files[sheetPath]) {
    return NextResponse.json({ error: 'Foglio "Dati" non trovato nel template' }, { status: 500 })
  }

  let sheetXml  = await zip.files[sheetPath].async('string')
  let stylesXml = zip.files['xl/styles.xml']
    ? await zip.files['xl/styles.xml'].async('string')
    : ''

  // Build a red-font style variant based on the style of cell A10
  let redStyleIdx: number | undefined
  if (stylesXml) {
    const baseStyleIdx = getCellStyleIdx(sheetXml, 'A10')
    const result = addRedXf(stylesXml, baseStyleIdx)
    stylesXml   = result.xml
    redStyleIdx = result.idx
  }

  // A3: first day of selected month
  sheetXml = setNumCell(sheetXml, 'A3', excelSerial(year, month, 1))

  // C5: generation date (today)
  const now = new Date()
  sheetXml = setNumCell(sheetXml, 'C5', excelSerial(now.getFullYear(), now.getMonth() + 1, now.getDate()))

  // Data rows 10–40 (days 1–31)
  const DATA_START = 10
  for (let day = 1; day <= 31; day++) {
    const row     = DATA_START + day - 1
    const addrA   = `A${row}`
    const addrD   = `D${row}`
    const addrE   = `E${row}`

    if (day <= daysInMonth) {
      const dateStr   = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const serial    = excelSerial(year, month, day)
      const dow       = new Date(year, month - 1, day).getDay() // 0=Sun, 6=Sat
      const isWeekend = dow === 0 || dow === 6
      const names     = shiftsByDate.get(dateStr) ?? []

      sheetXml = setNumCell(sheetXml, addrA, serial, isWeekend ? redStyleIdx : undefined)
      sheetXml = setInlineStr(sheetXml, addrD, names[0] ?? '', isWeekend)
      sheetXml = setInlineStr(sheetXml, addrE, names[1] ?? '', isWeekend)
    } else {
      // Month has fewer than 31 days — clear leftover name cells
      sheetXml = setInlineStr(sheetXml, addrD, '')
      sheetXml = setInlineStr(sheetXml, addrE, '')
    }
  }

  // Write modified files back into the ZIP
  zip.file(sheetPath, sheetXml)
  if (stylesXml) zip.file('xl/styles.xml', stylesXml)

  // Remove stale calculation chain (Excel will rebuild it on open)
  zip.remove('xl/calcChain.xml')

  const finalBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const fileName = `turni_${MONTH_NAMES_IT[month - 1]}_${year}.xlsx`

  return new NextResponse(finalBuf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
