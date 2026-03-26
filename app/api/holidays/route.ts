import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANDATORY_NAMES = [
  'Capodanno',
  'Epifania',
  'Pasqua',
  'Festa della Liberazione',
  'Festa dei Lavoratori',
  'Festa della Repubblica',
  'Ferragosto',
  'Natale',
]

interface NagerHoliday {
  date: string
  localName: string
  name: string
}

/**
 * GET /api/holidays
 * Lista tutte le festività ordinate per data.
 * Richiede autenticazione admin o manager.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    console.error('Errore fetch holidays:', error)
    return NextResponse.json({ error: 'Errore durante il recupero delle festività' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * POST /api/holidays
 *
 * Due modalità distinte in base al body:
 *   { year: number }                        → import da Nager.Date (admin only)
 *   { date: string, name: string, mandatory: boolean } → inserimento manuale (admin only)
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato — solo admin' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  /* ---------------------------------------------------------------- */
  /* Inserimento manuale: { date, name, mandatory }                   */
  /* ---------------------------------------------------------------- */
  if ('date' in body) {
    const date = typeof body.date === 'string' ? body.date.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const mandatory = typeof body.mandatory === 'boolean' ? body.mandatory : false

    if (!date || !name) {
      return NextResponse.json({ error: 'Campi obbligatori: date, name' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Formato data non valido (atteso: YYYY-MM-DD)' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('holidays')
      .upsert({ date, name, mandatory }, { onConflict: 'date' })
      .select()
      .single()

    if (error) {
      console.error('Errore inserimento manuale festività:', error)
      return NextResponse.json({ error: 'Errore durante l\'inserimento della festività' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  }

  /* ---------------------------------------------------------------- */
  /* Import da Nager.Date: { year }                                   */
  /* ---------------------------------------------------------------- */
  if ('year' in body) {
    const yearRaw = body.year
    if (
      typeof yearRaw !== 'number' ||
      !Number.isInteger(yearRaw) ||
      yearRaw < 2024 ||
      yearRaw > 2030
    ) {
      return NextResponse.json(
        { error: 'Anno non valido. Deve essere un intero tra 2024 e 2030.' },
        { status: 400 }
      )
    }

    const year = yearRaw

    let nagerData: NagerHoliday[]
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IT`)
      if (!res.ok) {
        return NextResponse.json(
          { error: `Nager.Date ha risposto con stato ${res.status}` },
          { status: 502 }
        )
      }
      nagerData = await res.json()
    } catch (err) {
      console.error('Errore chiamata Nager.Date:', err)
      return NextResponse.json({ error: 'Impossibile contattare Nager.Date' }, { status: 502 })
    }

    const records = nagerData.map((item) => {
      const mandatory = MANDATORY_NAMES.some(
        (m) => item.localName.includes(m) || item.name.includes(m)
      )
      return { date: item.date, name: item.localName, mandatory }
    })

    /* Recupera le date già presenti per l'anno */
    const { data: existing } = await supabase
      .from('holidays')
      .select('date')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)

    const existingDates = new Set<string>(
      (existing ?? []).map((h: { date: string }) => h.date)
    )

    const newRecords = records.filter((r) => !existingDates.has(r.date))
    const skipped = records.length - newRecords.length

    if (newRecords.length === 0) {
      /* Ritorna le festività esistenti per l'anno */
      const { data: currentHolidays } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
        .order('date', { ascending: true })

      return NextResponse.json({
        inserted: 0,
        skipped,
        holidays: currentHolidays ?? [],
      })
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('holidays')
      .upsert(newRecords, { onConflict: 'date' })
      .select()

    if (upsertError) {
      console.error('Errore upsert festività:', upsertError)
      return NextResponse.json({ error: 'Errore durante l\'importazione delle festività' }, { status: 500 })
    }

    return NextResponse.json({
      inserted: newRecords.length,
      skipped,
      holidays: upserted ?? [],
    })
  }

  return NextResponse.json(
    { error: 'Body non valido. Fornire { year } per import o { date, name, mandatory } per inserimento manuale.' },
    { status: 400 }
  )
}
