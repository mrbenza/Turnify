import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import JSZip from 'jszip'
import { sendTurniEmail } from '@/lib/email/sendTurniEmail'

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

/** Excel date serial: days since 1899-12-30 */
function excelSerial(year: number, month: number, day: number): number {
  const d = Date.UTC(year, month - 1, day)
  const epoch = Date.UTC(1899, 11, 30)
  return Math.round((d - epoch) / 86400000)
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Replace a numeric cell value (e.g. a date serial), preserving existing
 * s="..." style and removing any t="..." type attribute.
 */
function setNumCell(xml: string, addr: string, value: number): string {
  // [^>]*? lazy — stops before the '/' in self-closing tags like <c r="A1" s="5"/>
  // Greedy [^>]* would consume the '/', leaving only '>' which then mismatches />
  // and falls back to >[\s\S]*?</c>, spanning across multiple cells.
  const re = new RegExp('<c r="' + addr + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)')
  return xml.replace(re, (_match, attrs: string) => {
    const a = attrs.replace(/\s+t="[^"]*"/g, '')
    return `<c r="${addr}"${a}><v>${value}</v></c>`
  })
}

/**
 * Replace a cell with an inline string (t="inlineStr").
 * For red=true, the text is wrapped in a rich-text run with red color.
 * If the cell is absent from the XML, inserts it into the row element.
 */
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

  // Cell absent — insert into the row (only when there is a value to write)
  if (!value) return xml
  const rowNum = addr.replace(/[A-Z]+/g, '')
  const rowRe = new RegExp('(<row\\b[^>]*\\br="' + rowNum + '"[^>]*>)([\\s\\S]*?)(</row>)')
  return xml.replace(rowRe, (_m, open: string, content: string, close: string) =>
    open + content + makeCell('') + close
  )
}

/** Resolve the xl/worksheets/*.xml path for the sheet named "Dati" */
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
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('ruolo').eq('id', user.id).single()
  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager')
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2020 || year > 2100)
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })

  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  const { data: monthStatus } = await supabase
    .from('month_status')
    .select('status, email_inviata')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (!monthStatus || (monthStatus.status !== 'locked' && monthStatus.status !== 'confirmed')) {
    return NextResponse.json(
      { error: 'Il mese deve essere confermato prima di poter esportare.' },
      { status: 403 }
    )
  }

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
  // Usa il template specificato nel parametro, oppure il primo file disponibile nel bucket
  const serviceClient = createServiceClient()
  const templateParam = searchParams.get('template')

  let templateName = templateParam
  if (!templateName) {
    const { data: fileList } = await serviceClient.storage.from('templates').list()
    const xlsxFiles = (fileList ?? []).filter((f: { name: string }) => f.name.endsWith('.xlsx'))
    if (xlsxFiles.length === 0) {
      return NextResponse.json({ error: 'Nessun template Excel trovato nello storage' }, { status: 500 })
    }
    templateName = xlsxFiles[0].name
  }

  const { data: blob, error: storageError } = await serviceClient.storage
    .from('templates').download(templateName)

  if (storageError || !blob) {
    console.error('Template non trovato:', storageError)
    return NextResponse.json({ error: `Template "${templateName}" non trovato nello storage` }, { status: 500 })
  }

  const templateBuf = await blob.arrayBuffer()
  const zip = await JSZip.loadAsync(templateBuf)

  // Locate "Dati" worksheet
  const sheetPath = await getDatiSheetPath(zip)
  if (!sheetPath || !zip.files[sheetPath]) {
    return NextResponse.json({ error: 'Foglio "Dati" non trovato nel template' }, { status: 500 })
  }

  let sheetXml = await zip.files[sheetPath].async('string')

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

      // Column A: date as serial number (template's cell format + CF handle display/colour)
      sheetXml = setNumCell(sheetXml, addrA, serial)
      // Columns D/E: cognome as inline string; red rich-text on weekends
      sheetXml = setInlineStr(sheetXml, addrD, names[0] ?? '', isWeekend)
      sheetXml = setInlineStr(sheetXml, addrE, names[1] ?? '', isWeekend)
    } else {
      // Month shorter than 31 days — clear leftover name cells
      sheetXml = setInlineStr(sheetXml, addrD, '')
      sheetXml = setInlineStr(sheetXml, addrE, '')
    }
  }

  // Write modified sheet back into the ZIP (all other files stay untouched)
  zip.file(sheetPath, sheetXml)

  // Remove stale calculation chain (Excel rebuilds it on open)
  zip.remove('xl/calcChain.xml')

  const finalBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  try {
    await serviceClient
      .from('availability')
      .update({ status: 'approved' })
      .eq('status', 'pending')
      .gte('date', from)
      .lte('date', to)

    await serviceClient
      .from('month_status')
      .update({ status: 'confirmed' })
      .eq('month', month)
      .eq('year', year)
  } catch (err) {
    console.error('Errore aggiornamento stato post-export (non bloccante):', err)
  }

  // Invia email notifica se non ancora inviata
  if (!monthStatus?.email_inviata) {
    try {
      const [{ data: employees }, { data: extraEmails }] = await Promise.all([
        serviceClient
          .from('users')
          .select('email, nome')
          .eq('ruolo', 'dipendente')
          .eq('attivo', true),
        serviceClient
          .from('email_settings')
          .select('email, descrizione')
          .eq('attivo', true),
      ])

      const recipients = [
        ...(employees ?? []).map((u: { email: string; nome: string }) => ({ email: u.email, name: u.nome })),
        ...(extraEmails ?? []).map((e: { email: string; descrizione: string | null }) => ({ email: e.email, name: e.descrizione ?? undefined })),
      ]

      await sendTurniEmail({ month, year, shiftsByDate, recipients })

      await serviceClient
        .from('month_status')
        .update({ email_inviata: true, email_inviata_at: new Date().toISOString() })
        .eq('month', month)
        .eq('year', year)
    } catch (err) {
      console.error('Errore invio email turni (non bloccante):', err)
    }
  }

  const fileName = `turni_${MONTH_NAMES_IT[month - 1]}_${year}.xlsx`

  return new NextResponse(finalBuf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
