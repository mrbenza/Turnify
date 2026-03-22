import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

/** Excel serial date → oggetto Date UTC */
function fromExcelSerial(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30)
  return new Date(epoch + serial * 86400000)
}

/** Estrae il testo da una cella (supporta inlineStr plain e rich text) */
function getCellText(xml: string, addr: string): string {
  const cellRe = new RegExp('<c r="' + addr + '"[^>]*>([\\s\\S]*?)</c>')
  const cellMatch = xml.match(cellRe)
  if (!cellMatch) return ''
  const inner = cellMatch[1]
  // Estrai tutti i tag <t>...</t> e concatena (gestisce rich text multi-run)
  const tMatches = [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)]
  return tMatches.map(m => m[1]).join('').trim()
}

/** Estrae il valore numerico da una cella */
function getCellNumber(xml: string, addr: string): number | null {
  const re = new RegExp('<c r="' + addr + '"[^>]*?>\\s*<v>([^<]+)<\\/v>')
  const m = xml.match(re)
  if (!m) return null
  const n = parseFloat(m[1])
  return isNaN(n) ? null : n
}

/** Risolve il percorso del foglio "Dati" nel workbook */
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

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth: solo admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato — solo admin' }, { status: 403 })
  }

  // Leggi FormData
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corpo della richiesta non valido' }, { status: 400 })
  }

  const fileEntry = formData.get('file')
  if (!fileEntry || !(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'File non trovato nel form data' }, { status: 400 })
  }

  const file = fileEntry as File

  // Validazione: solo .xlsx
  if (!file.name.endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Formato non supportato — caricare un file .xlsx' }, { status: 400 })
  }

  // Parse JSZip
  const arrayBuf = await file.arrayBuffer()
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(arrayBuf)
  } catch {
    return NextResponse.json({ error: 'Impossibile aprire il file Excel — file corrotto o formato non valido' }, { status: 400 })
  }

  // Trova foglio "Dati"
  const sheetPath = await getDatiSheetPath(zip)
  if (!sheetPath || !zip.files[sheetPath]) {
    return NextResponse.json({ error: 'Foglio "Dati" non trovato nel file Excel' }, { status: 400 })
  }

  const sheetXml = await zip.files[sheetPath].async('string')

  // Estrai mese/anno da A3 (Excel serial date del primo giorno del mese)
  const a3Value = getCellNumber(sheetXml, 'A3')
  if (a3Value === null) {
    return NextResponse.json({ error: 'Impossibile determinare il mese dal file — cella A3 mancante o non numerica' }, { status: 400 })
  }

  const firstDay = fromExcelSerial(a3Value)
  const year = firstDay.getUTCFullYear()
  const month = firstDay.getUTCMonth() + 1 // 1-based

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Impossibile determinare il mese dal file — data non valida in A3' }, { status: 400 })
  }

  // Build cognome → user map (solo dipendenti attivi)
  const serviceClient = createServiceClient()

  const { data: usersData, error: usersError } = await serviceClient
    .from('users')
    .select('id, nome')
    .eq('ruolo', 'dipendente')

  if (usersError) {
    console.error('Errore fetch utenti:', usersError)
    return NextResponse.json({ error: 'Errore lettura utenti dal database' }, { status: 500 })
  }

  const cognomeMap = new Map<string, { id: string; nome: string }[]>()
  for (const u of (usersData ?? []) as { id: string; nome: string }[]) {
    const idx = u.nome.indexOf(' ')
    const cognome = idx === -1 ? u.nome : u.nome.slice(idx + 1)
    if (!cognomeMap.has(cognome)) cognomeMap.set(cognome, [])
    cognomeMap.get(cognome)!.push(u)
  }

  // Fetch holidays per il mese importato
  const monthStr = String(month).padStart(2, '0')
  const daysInMonth = new Date(year, month, 0).getDate()
  const fromDate = `${year}-${monthStr}-01`
  const toDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`

  const { data: holidaysData } = await serviceClient
    .from('holidays')
    .select('date, mandatory')
    .gte('date', fromDate)
    .lte('date', toDate)

  const holidayDates = new Set<string>(
    (holidaysData ?? [])
      .filter((h: { date: string; mandatory: boolean }) => h.mandatory)
      .map((h: { date: string }) => h.date)
  )

  // Itera righe 10-40 (giorni 1-31)
  const DATA_START = 10
  const shiftsToInsert: {
    date: string
    user_id: string
    user_nome: string
    shift_type: 'reperibilita' | 'weekend' | 'festivo'
    created_by: string
  }[] = []
  const unmatched: string[] = []
  const ambiguous: string[] = []
  const pendingShifts: Record<string, { date: string; shift_type: string }[]> = {}

  for (let day = 1; day <= 31; day++) {
    const row = DATA_START + day - 1

    // Verifica che la data sia valida per questo mese
    if (day > daysInMonth) break

    const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`
    const dow = new Date(year, month - 1, day).getDay() // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6
    const isHoliday = holidayDates.has(dateStr)
    const shiftType = isHoliday ? 'festivo' : isWeekend ? 'weekend' : 'reperibilita'

    const cellsToCheck = [`D${row}`, `E${row}`]
    for (const addr of cellsToCheck) {
      const cognome = getCellText(sheetXml, addr)
      if (!cognome) continue

      const matches = cognomeMap.get(cognome)
      if (!matches || matches.length === 0) {
        if (!pendingShifts[cognome]) pendingShifts[cognome] = []
        pendingShifts[cognome].push({ date: dateStr, shift_type: shiftType })
        unmatched.push(cognome)
        continue
      }

      if (matches.length > 1) {
        ambiguous.push(cognome)
        continue
      }

      const foundUser = matches[0]
      shiftsToInsert.push({
        date: dateStr,
        user_id: foundUser.id,
        user_nome: foundUser.nome,
        shift_type: shiftType,
        created_by: user.id,
      })
    }
  }

  // Upsert turni (onConflict: 'date,user_id' — ignora duplicati)
  let inserted: unknown[] = []
  if (shiftsToInsert.length > 0) {
    const { data: insertedData, error: insertError } = await serviceClient
      .from('shifts')
      .upsert(shiftsToInsert, { onConflict: 'date,user_id', ignoreDuplicates: true })
      .select()

    if (insertError) {
      console.error('Errore upsert turni:', insertError)
      return NextResponse.json({ error: 'Errore inserimento turni nel database' }, { status: 500 })
    }

    inserted = insertedData ?? []
  }

  // Chiudi il mese: confirmed se passato, locked se mese corrente
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const isPast = year < currentYear || (year === currentYear && month < currentMonth)
  const finalStatus = isPast ? 'confirmed' : 'locked'

  const { error: lockError } = await serviceClient
    .from('month_status')
    .upsert(
      {
        month,
        year,
        status: finalStatus,
        locked_by: user.id,
        locked_at: new Date().toISOString(),
      },
      { onConflict: 'month,year' }
    )

  if (lockError) {
    console.error('Errore lock mese:', lockError)
    // Non bloccante — i turni sono già stati inseriti
  }

  return NextResponse.json({
    month,
    year,
    imported: inserted.length,
    skipped: shiftsToInsert.length - inserted.length,
    unmatched: [...new Set(unmatched)],
    ambiguous: [...new Set(ambiguous)],
    pendingShifts,
  })
}
