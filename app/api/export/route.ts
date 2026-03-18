import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export async function GET(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()
  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // Parse params — month è 1-based (1=Gennaio...12=Dicembre)
  const { searchParams } = new URL(request.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  // Fetch turni del mese
  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('date, user_id')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (shiftsError) {
    console.error('Errore fetch turni:', shiftsError)
    return NextResponse.json({ error: 'Errore lettura turni dal database' }, { status: 500 })
  }

  // Fetch nomi dipendenti
  const { data: users } = await supabase.from('users').select('id, nome')
  // Usa solo il cognome (tutto dopo il primo spazio): "Mario De Luca" → "De Luca"
  const userMap = new Map<string, string>(
    (users ?? []).map((u: { id: string; nome: string }) => {
      const idx = u.nome.indexOf(' ')
      const cognome = idx === -1 ? u.nome : u.nome.slice(idx + 1)
      return [u.id, cognome]
    })
  )

  // Raggruppa i turni per data → array di nomi (1° e 2° reperibile)
  const shiftsByDate = new Map<string, string[]>()
  for (const shift of shifts ?? []) {
    if (!shiftsByDate.has(shift.date)) shiftsByDate.set(shift.date, [])
    shiftsByDate.get(shift.date)!.push(userMap.get(shift.user_id) ?? shift.user_id)
  }

  // Scarica il template da Supabase Storage
  const serviceClient = createServiceClient()
  const { data: templateBlob, error: storageError } = await serviceClient.storage
    .from('templates')
    .download('AREA4.xlsx')

  if (storageError || !templateBlob) {
    console.error('Errore download template da Storage:', storageError)
    return NextResponse.json({ error: 'Template Excel non trovato nello storage' }, { status: 500 })
  }

  const templateArrayBuf = await templateBlob.arrayBuffer()

  // Legge il template con ExcelJS per modificare celle dati
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(templateArrayBuf)
  } catch (e) {
    console.error('Errore parsing template Excel:', e)
    return NextResponse.json({ error: 'Errore parsing template Excel' }, { status: 500 })
  }

  const ws = wb.getWorksheet('Dati')
  if (!ws) {
    return NextResponse.json({ error: 'Template non valido: foglio "Dati" non trovato' }, { status: 500 })
  }

  // Aggiorna A3: primo giorno del mese selezionato (formato "mmmm yyyy")
  ws.getCell('A3').value = new Date(year, month - 1, 1)

  // Aggiorna C5: data di generazione
  ws.getCell('C5').value = new Date()

  // Aggiorna dati giornalieri (righe 10-40)
  const DATA_START_ROW = 10
  const RED_ARGB = 'FFFF0000'
  for (let day = 1; day <= 31; day++) {
    const rowNum = DATA_START_ROW + (day - 1)
    if (day <= daysInMonth) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const names = shiftsByDate.get(dateStr) ?? []
      const dow = new Date(year, month - 1, day).getDay() // 0=Dom, 6=Sab
      const isWeekend = dow === 0 || dow === 6

      const cellA = ws.getCell(`A${rowNum}`)
      const cellD = ws.getCell(`D${rowNum}`)
      const cellE = ws.getCell(`E${rowNum}`)

      cellA.value = new Date(year, month - 1, day)
      cellD.value = names[0] ?? ''
      cellE.value = names[1] ?? ''

      // Sabato e domenica: testo in rosso su data e nomi reperibili
      if (isWeekend) {
        cellA.font = { ...cellA.font, color: { argb: RED_ARGB } }
        cellD.font = { ...cellD.font, color: { argb: RED_ARGB } }
        cellE.font = { ...cellE.font, color: { argb: RED_ARGB } }
      }
    } else {
      ws.getCell(`D${rowNum}`).value = ''
      ws.getCell(`E${rowNum}`).value = ''
    }
  }

  // ExcelJS non serializza le regole di conditional formatting del template
  // (CfRuleXform.renderExpression crash). Le azzeriamo — i colori fissi delle
  // celle rimangono perché sono negli stili delle celle stesse.
  wb.eachSheet((sheet) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sheet as any).conditionalFormattings = []
  })

  // Genera il buffer base con ExcelJS
  const excelBuf = Buffer.from(await wb.xlsx.writeBuffer())

  // -----------------------------------------------------------------------
  // Iniezione immagini via JSZip
  //
  // ExcelJS non supporta le immagini "in cella" di Excel (rich values).
  // Il template le usa: xl/media/image*.* + xl/richData/*.
  // Strategia: carichiamo entrambi i ZIP (template e output ExcelJS), copiamo
  // i file richData + media dal template nell'output, aggiorniamo le relazioni
  // e i content types, poi generiamo il file finale.
  // -----------------------------------------------------------------------
  const [outputZip, templateZip] = await Promise.all([
    JSZip.loadAsync(excelBuf),
    JSZip.loadAsync(templateArrayBuf),
  ])

  // File da copiare dal template all'output
  const filesToCopy = [
    'xl/metadata.xml',
    'xl/richData/richValueRel.xml',
    'xl/richData/rdrichvalue.xml',
    'xl/richData/rdrichvaluestructure.xml',
    'xl/richData/rdRichValueTypes.xml',
    'xl/richData/_rels/richValueRel.xml.rels',
  ]
  // Copia tutti i file media (immagini)
  for (const name of Object.keys(templateZip.files)) {
    if (name.startsWith('xl/media/')) filesToCopy.push(name)
  }

  for (const path of filesToCopy) {
    if (templateZip.files[path]) {
      const content = await templateZip.files[path].async('nodebuffer')
      outputZip.file(path, content)
    }
  }

  // Aggiunge le relazioni richData nel workbook.xml.rels dell'output.
  // Usiamo rId con numeri alti (100+) per evitare conflitti con quelli di ExcelJS.
  const richDataRels = [
    `<Relationship Id="rId100" Type="http://schemas.microsoft.com/office/2022/10/relationships/richValueRel" Target="richData/richValueRel.xml"/>`,
    `<Relationship Id="rId101" Type="http://schemas.microsoft.com/office/2017/06/relationships/rdRichValue" Target="richData/rdrichvalue.xml"/>`,
    `<Relationship Id="rId102" Type="http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueStructure" Target="richData/rdrichvaluestructure.xml"/>`,
    `<Relationship Id="rId103" Type="http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueTypes" Target="richData/rdRichValueTypes.xml"/>`,
    `<Relationship Id="rId104" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata" Target="metadata.xml"/>`,
  ].join('')

  const wbRels = await outputZip.files['xl/_rels/workbook.xml.rels'].async('string')
  outputZip.file('xl/_rels/workbook.xml.rels', wbRels.replace('</Relationships>', richDataRels + '</Relationships>'))

  // Aggiunge i content types mancanti per immagini e richData
  const richDataContentTypes = [
    `<Default Extension="jpeg" ContentType="image/jpeg"/>`,
    `<Default Extension="png" ContentType="image/png"/>`,
    `<Override PartName="/xl/metadata.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml"/>`,
    `<Override PartName="/xl/richData/richValueRel.xml" ContentType="application/vnd.ms-excel.richvaluerel+xml"/>`,
    `<Override PartName="/xl/richData/rdrichvalue.xml" ContentType="application/vnd.ms-excel.rdrichvalue+xml"/>`,
    `<Override PartName="/xl/richData/rdrichvaluestructure.xml" ContentType="application/vnd.ms-excel.rdrichvaluestructure+xml"/>`,
    `<Override PartName="/xl/richData/rdRichValueTypes.xml" ContentType="application/vnd.ms-excel.rdrichvaluetypes+xml"/>`,
  ]

  let contentTypes = await outputZip.files['[Content_Types].xml'].async('string')
  for (const entry of richDataContentTypes) {
    // Evita duplicati
    const key = entry.match(/(?:Extension|PartName)="([^"]+)"/)?.[1] ?? ''
    if (key && !contentTypes.includes(key)) {
      contentTypes = contentTypes.replace('</Types>', entry + '</Types>')
    }
  }
  outputZip.file('[Content_Types].xml', contentTypes)

  // Genera il file finale
  const finalBuf = await outputZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const fileName = `turni_${MONTH_NAMES_IT[month - 1]}_${year}.xlsx`

  return new NextResponse(finalBuf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
