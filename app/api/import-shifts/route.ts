import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { MonthStatusValue } from '@/lib/supabase/types'
import JSZip from 'jszip'

/** Excel serial date → oggetto Date UTC */
function fromExcelSerial(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30)
  return new Date(epoch + serial * 86400000)
}

/** Carica shared strings dal file Excel */
async function getSharedStrings(zip: JSZip): Promise<string[]> {
  const sstFile = zip.files['xl/sharedStrings.xml']
  if (!sstFile) return []
  const xml = await sstFile.async('string')
  const matches = [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
  return matches.map(m => {
    const tMatches = [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)]
    return tMatches.map(t => t[1]).join('').trim()
  })
}

/**
 * Estrae il testo da una cella.
 * Supporta: inlineStr (plain e rich text) e shared strings (t="s").
 */
function getCellText(xml: string, addr: string, sharedStrings: string[]): string {
  const cellRe = new RegExp('<c r="' + addr + '"([^>]*)>([\\s\\S]*?)</c>')
  const cellMatch = xml.match(cellRe)
  if (!cellMatch) return ''
  const attrs = cellMatch[1]
  const inner = cellMatch[2]

  // Shared string
  if (attrs.includes('t="s"')) {
    const vMatch = inner.match(/<v>(\d+)<\/v>/)
    if (!vMatch) return ''
    const idx = parseInt(vMatch[1], 10)
    return sharedStrings[idx] ?? ''
  }

  // inlineStr / rich text
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

/** Estrae il cognome da un nome completo (tutto dopo il primo spazio) */
function toCognome(nome: string): string {
  const idx = nome.indexOf(' ')
  return idx === -1 ? nome : nome.slice(idx + 1)
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

  const [sheetXml, sharedStrings] = await Promise.all([
    zip.files[sheetPath].async('string'),
    getSharedStrings(zip),
  ])

  // ----------------------------------------------------------------
  // Leggi area e manager dal file
  // ----------------------------------------------------------------
  const areaNomeFile = getCellText(sheetXml, 'A1', sharedStrings)
  const managerCognomeFile = getCellText(sheetXml, 'B51', sharedStrings)

  // ----------------------------------------------------------------
  // Risolvi area nel DB
  // ----------------------------------------------------------------
  // service_role: UPSERT shifts + INSERT/UPDATE month_status cross-area (import storico admin)
  const serviceClient = createServiceClient()
  let targetAreaId: string | null = null
  let areaWarning: string | null = null

  // 1. Cerca per nome area (A1)
  if (areaNomeFile) {
    // Prima prova match esatto (case-insensitive)
    const { data: exactMatch } = await serviceClient
      .from('areas')
      .select('id, nome, manager_id')
      .ilike('nome', areaNomeFile)
      .single()

    let areaByName = exactMatch

    // Se non trovato, prova match per prefisso (es. "Area4" → "Area4 - Piemonte")
    if (!areaByName) {
      const { data: prefixMatches } = await serviceClient
        .from('areas')
        .select('id, nome, manager_id')
        .ilike('nome', `${areaNomeFile}%`)

      if (prefixMatches && prefixMatches.length === 1) {
        areaByName = prefixMatches[0]
        areaWarning = `Area identificata per prefisso: "${areaNomeFile}" → "${areaByName.nome}"`
      } else if (prefixMatches && prefixMatches.length > 1) {
        return NextResponse.json({
          error: `Nome area ambiguo: "${areaNomeFile}" corrisponde a più aree (${prefixMatches.map(a => a.nome).join(', ')}). Specifica il nome completo nel file.`,
        }, { status: 400 })
      }
    }

    // Se ancora non trovato, prova match normalizzato (lowercase + rimozione spazi)
    // Es. "AREA 6" → "area6" matcha "Area6 - Liguria" → "area6"
    if (!areaByName) {
      const normalizeStr = (s: string) => s.toLowerCase().replace(/\s+/g, '')
      const normalizedFile = normalizeStr(areaNomeFile)

      const { data: allAreas } = await serviceClient
        .from('areas')
        .select('id, nome, manager_id')

      const normalizedMatches = (allAreas ?? []).filter(
        a => normalizeStr(a.nome).startsWith(normalizedFile)
      )

      if (normalizedMatches.length === 1) {
        areaByName = normalizedMatches[0]
        areaWarning = `Area identificata per nome normalizzato: "${areaNomeFile}" → "${areaByName.nome}"`
      } else if (normalizedMatches.length > 1) {
        return NextResponse.json({
          error: `Nome area ambiguo: "${areaNomeFile}" corrisponde a più aree (${normalizedMatches.map(a => a.nome).join(', ')}). Specifica il nome completo nel file.`,
        }, { status: 400 })
      }
    }

    if (areaByName) {
      targetAreaId = areaByName.id

      // Cross-check manager (B51)
      if (managerCognomeFile && areaByName.manager_id) {
        const { data: mgr } = await serviceClient
          .from('users')
          .select('nome')
          .eq('id', areaByName.manager_id)
          .single()
        if (mgr) {
          const cognomeDB = toCognome(mgr.nome)
          if (cognomeDB.toLowerCase() !== managerCognomeFile.toLowerCase()) {
            const existingWarning = areaWarning ? `${areaWarning}. ` : ''
            areaWarning = `${existingWarning}Manager nel file ("${managerCognomeFile}") non corrisponde al manager dell'area nel DB ("${cognomeDB}") — importazione comunque effettuata su ${areaByName.nome}`
          }
        }
      }
    }
  }

  // 2. Fallback: cerca per cognome manager (B51)
  if (!targetAreaId && managerCognomeFile) {
    const { data: allManagers } = await serviceClient
      .from('users')
      .select('id, nome')
      .eq('ruolo', 'manager')

    const matchedMgr = (allManagers ?? []).find(
      u => toCognome(u.nome).toLowerCase() === managerCognomeFile.toLowerCase()
    )

    if (matchedMgr) {
      const { data: areaByMgr } = await serviceClient
        .from('areas')
        .select('id, nome')
        .eq('manager_id', matchedMgr.id)
        .single()

      if (areaByMgr) {
        targetAreaId = areaByMgr.id
        areaWarning = `Area identificata tramite manager "${managerCognomeFile}" → ${areaByMgr.nome} (nome area nel file: "${areaNomeFile || 'non trovato'}")`
      }
    }
  }

  if (!targetAreaId) {
    return NextResponse.json({
      error: `Area non riconosciuta. Nome area nel file: "${areaNomeFile || '—'}", Manager: "${managerCognomeFile || '—'}". Verifica che il file sia stato generato da Turnify.`,
    }, { status: 400 })
  }

  // ----------------------------------------------------------------
  // Estrai mese/anno da A3
  // ----------------------------------------------------------------
  const a3Value = getCellNumber(sheetXml, 'A3')
  if (a3Value === null) {
    return NextResponse.json({ error: 'Impossibile determinare il mese dal file — cella A3 mancante o non numerica' }, { status: 400 })
  }

  const firstDay = fromExcelSerial(a3Value)
  const year = firstDay.getUTCFullYear()
  const month = firstDay.getUTCMonth() + 1

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Impossibile determinare il mese dal file — data non valida in A3' }, { status: 400 })
  }

  // ----------------------------------------------------------------
  // Blocco immutabilità: rifiuta import su mese locked o confirmed
  // ----------------------------------------------------------------
  const { data: existingMonthStatus } = await serviceClient
    .from('month_status')
    .select('id, status')
    .eq('month', month)
    .eq('year', year)
    .eq('area_id', targetAreaId)
    .maybeSingle()

  if (existingMonthStatus?.status === 'locked' || existingMonthStatus?.status === 'confirmed') {
    return NextResponse.json(
      { error: `Impossibile importare: il mese ${month}/${year} è già ${existingMonthStatus.status === 'confirmed' ? 'confermato' : 'bloccato'}. Sblocca il mese prima di importare.` },
      { status: 422 }
    )
  }

  // ----------------------------------------------------------------
  // Build cognome → user map (solo dipendenti dell'area trovata)
  // ----------------------------------------------------------------
  const { data: usersData, error: usersError } = await serviceClient
    .from('users')
    .select('id, nome')
    .eq('ruolo', 'dipendente')
    .eq('area_id', targetAreaId)

  if (usersError) {
    console.error('Errore fetch utenti:', usersError)
    return NextResponse.json({ error: 'Errore lettura utenti dal database' }, { status: 500 })
  }

  const cognomeMap = new Map<string, { id: string; nome: string }[]>()
  for (const u of (usersData ?? []) as { id: string; nome: string }[]) {
    const cognome = toCognome(u.nome)
    if (!cognomeMap.has(cognome)) cognomeMap.set(cognome, [])
    cognomeMap.get(cognome)!.push(u)
  }

  // ----------------------------------------------------------------
  // Fetch holidays
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // Itera righe 10-40 (giorni 1-31)
  // ----------------------------------------------------------------
  const DATA_START = 10
  const shiftsToInsert: {
    date: string
    user_id: string
    user_nome: string
    shift_type: 'reperibilita' | 'weekend' | 'festivo'
    reperibile_order: 1 | 2
    created_by: string
    area_id: string
  }[] = []
  const unmatched: string[] = []
  const ambiguous: string[] = []
  const pendingShifts: Record<string, { date: string; shift_type: string; reperibile_order: 1 | 2 }[]> = {}

  for (let day = 1; day <= 31; day++) {
    const row = DATA_START + day - 1
    if (day > daysInMonth) break

    const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`
    const dow = new Date(year, month - 1, day).getDay()
    const isWeekend = dow === 0 || dow === 6
    const isHoliday = holidayDates.has(dateStr)
    const shiftType = isHoliday ? 'festivo' : isWeekend ? 'weekend' : 'reperibilita'

    for (const { addr, order } of [{ addr: `D${row}`, order: 1 as const }, { addr: `E${row}`, order: 2 as const }]) {
      const cognome = getCellText(sheetXml, addr, sharedStrings)
      if (!cognome) continue

      const matches = cognomeMap.get(cognome)
      if (!matches || matches.length === 0) {
        if (!pendingShifts[cognome]) pendingShifts[cognome] = []
        pendingShifts[cognome].push({ date: dateStr, shift_type: shiftType, reperibile_order: order })
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
        reperibile_order: order,
        created_by: user.id,
        area_id: targetAreaId,
      })
    }
  }

  // ----------------------------------------------------------------
  // Upsert turni
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // Chiudi il mese
  // ----------------------------------------------------------------
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const isPast = year < currentYear || (year === currentYear && month < currentMonth)
  const finalStatus = isPast ? 'confirmed' : ('locked' as const)

  const lockPayload = {
    status: finalStatus as MonthStatusValue,
    locked_by: user.id,
    locked_at: new Date().toISOString(),
  }

  if (existingMonthStatus) {
    await serviceClient
      .from('month_status')
      .update(lockPayload)
      .eq('month', month)
      .eq('year', year)
      .eq('area_id', targetAreaId)
  } else {
    await serviceClient
      .from('month_status')
      .insert({ month, year, area_id: targetAreaId, ...lockPayload })
  }

  return NextResponse.json({
    month,
    year,
    areaId: targetAreaId,
    areaNome: areaNomeFile,
    areaWarning,
    imported: inserted.length,
    skipped: shiftsToInsert.length - inserted.length,
    unmatched: [...new Set(unmatched)],
    ambiguous: [...new Set(ambiguous)],
    pendingShifts,
  })
}
