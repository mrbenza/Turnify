import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

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
  const userMap = new Map<string, string>(
    (users ?? []).map((u: { id: string; nome: string }) => [u.id, u.nome])
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

  let templateArrayBuf: ArrayBuffer
  try {
    templateArrayBuf = await templateBlob.arrayBuffer()
  } catch (e) {
    console.error('Errore conversione template in buffer:', e)
    return NextResponse.json({ error: 'Errore lettura template' }, { status: 500 })
  }

  // Legge il template con exceljs — preserva stili, font, immagini, merged cells
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

  // Aggiorna A3: data del primo giorno del mese selezionato (formatted "mmmm yyyy")
  const firstDay = new Date(year, month - 1, 1)
  const cellA3 = ws.getCell('A3')
  cellA3.value = firstDay

  // Aggiorna C5: data di generazione (oggi)
  const cellC5 = ws.getCell('C5')
  cellC5.value = new Date()

  // Aggiorna i dati per ogni giorno del mese (righe 10-40)
  const DATA_START_ROW = 10
  for (let day = 1; day <= 31; day++) {
    const rowNum = DATA_START_ROW + (day - 1)

    if (day <= daysInMonth) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const names = shiftsByDate.get(dateStr) ?? []

      // Colonna A: data del giorno
      const cellA = ws.getCell(`A${rowNum}`)
      cellA.value = new Date(year, month - 1, day)

      // Colonna D: 1° reperibile
      ws.getCell(`D${rowNum}`).value = names[0] ?? ''

      // Colonna E: 2° reperibile
      ws.getCell(`E${rowNum}`).value = names[1] ?? ''
    } else {
      // Righe extra (mesi < 31 giorni): svuota i nomi
      ws.getCell(`D${rowNum}`).value = ''
      ws.getCell(`E${rowNum}`).value = ''
    }
  }

  // ExcelJS non riesce a serializzare le regole di formattazione condizionale
  // del template (CfRuleXform.renderExpression → crash). Le azzeriamo prima
  // di scrivere: i colori delle celle sono già embedded negli stili delle celle
  // stesse, quindi il file rimane visivamente corretto.
  wb.eachSheet((sheet) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sheet as any).conditionalFormattings = []
  })

  // Genera il buffer XLSX
  const outBuf = Buffer.from(await wb.xlsx.writeBuffer())
  const fileName = `turni_${MONTH_NAMES_IT[month - 1]}_${year}.xlsx`

  return new NextResponse(outBuf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
