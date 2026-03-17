import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

// Excel date serial: days since Dec 30, 1899 (with intentional 1900 leap year bug)
function dateToExcelSerial(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month - 1, day))
  const epoch = new Date(Date.UTC(1899, 11, 30))
  return Math.round((date.getTime() - epoch.getTime()) / 86400000)
}

function setCell(ws: XLSX.WorkSheet, addr: string, value: string | number, type: 's' | 'n') {
  if (ws[addr]) {
    ws[addr].v = value
    ws[addr].t = type
    delete ws[addr].w // rimuove il valore formattato in cache
  } else {
    ws[addr] = { t: type, v: value }
  }
}

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

  // Fetch festività dell'anno per aggiornare il foglio Festivita
  const yearFrom = `${year}-01-01`
  const yearTo = `${year}-12-31`
  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .gte('date', yearFrom)
    .lte('date', yearTo)
    .order('date', { ascending: true })

  // Scarica il template da Supabase Storage (bucket privato)
  const serviceClient = createServiceClient()
  const { data: templateBlob, error: storageError } = await serviceClient.storage
    .from('templates')
    .download('AREA4.xlsx')

  if (storageError || !templateBlob) {
    console.error('Errore download template da Storage:', storageError)
    return NextResponse.json({ error: 'Template Excel non trovato nello storage' }, { status: 500 })
  }

  const templateBuf = Buffer.from(await templateBlob.arrayBuffer())

  const wb = XLSX.read(templateBuf, { type: 'buffer', cellStyles: true })
  const ws = wb.Sheets['Dati']
  if (!ws) {
    return NextResponse.json({ error: 'Template non valido: foglio "Dati" non trovato' }, { status: 500 })
  }

  // Aggiorna le celle per ogni giorno del mese (righe 10-40)
  const DATA_START_ROW = 10
  for (let day = 1; day <= 31; day++) {
    const rowNum = DATA_START_ROW + (day - 1)

    if (day <= daysInMonth) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const serial = dateToExcelSerial(year, month, day)
      const names = shiftsByDate.get(dateStr) ?? []

      // Colonna A: data (numero seriale Excel)
      setCell(ws, `A${rowNum}`, serial, 'n')

      // Colonna D: 1° reperibile
      setCell(ws, `D${rowNum}`, names[0] ?? '', 's')

      // Colonna E: 2° reperibile
      setCell(ws, `E${rowNum}`, names[1] ?? '', 's')
    } else {
      // Mesi con meno di 31 giorni: svuota le colonne nomi nelle righe extra
      setCell(ws, `D${rowNum}`, '', 's')
      setCell(ws, `E${rowNum}`, '', 's')
    }
  }

  // Aggiorna il foglio Festivita con le festività dell'anno selezionato
  const wsFestivita = wb.Sheets['Festivita']
  if (wsFestivita && holidays && holidays.length > 0) {
    holidays.forEach((h: { date: string }, i: number) => {
      const [y, m, d] = h.date.split('-').map(Number)
      const serial = dateToExcelSerial(y, m, d)
      const addr = XLSX.utils.encode_cell({ r: i, c: 0 })
      wsFestivita[addr] = { t: 'n', v: serial }
    })
    wsFestivita['!ref'] = `A1:A${holidays.length}`
  }

  // Genera il file XLSX
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outBuf: any = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
  const fileName = `turni_${MONTH_NAMES_IT[month - 1]}_${year}.xlsx`

  return new NextResponse(outBuf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
