import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Admin check
  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, area_id')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // Parse body
  let body: { month?: number; year?: number; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { month, year, action } = body

  if (month === undefined || year === undefined || !action) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti: month, year, action' }, { status: 400 })
  }

  if (action !== 'lock' && action !== 'unlock') {
    return NextResponse.json({ error: 'Valore action non valido. Atteso: lock | unlock' }, { status: 400 })
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Valore month non valido. Atteso: 1-12' }, { status: 400 })
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Valore year non valido.' }, { status: 400 })
  }

  // service_role: SELECT areas/holidays/shifts per validazione + UPDATE month_status (coerenza con bypass RLS admin)
  const serviceClient = createServiceClient()

  // ----------------------------------------------------------------
  // Validazione copertura: solo per action === 'lock'
  // Ogni sabato, domenica e festività obbligatoria del mese deve avere
  // esattamente workers_per_day turni assegnati.
  // ----------------------------------------------------------------
  if (action === 'lock') {
    // Leggi workers_per_day dell'area
    const { data: area } = await serviceClient
      .from('areas')
      .select('workers_per_day')
      .eq('id', profile.area_id)
      .single()

    const workersPerDay = area?.workers_per_day ?? 2
    const daysInMonth = new Date(year, month, 0).getDate()
    const pad = (n: number) => String(n).padStart(2, '0')
    const monthStart = `${year}-${pad(month)}-01`
    const monthEnd   = `${year}-${pad(month)}-${pad(daysInMonth)}`

    // Calcola tutti i sabati e domeniche del mese
    const requiredDays = new Set<string>()
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow === 0 || dow === 6) {
        requiredDays.add(`${year}-${pad(month)}-${pad(d)}`)
      }
    }

    // Aggiunge le festività obbligatorie del mese (possono essere giorni feriali)
    const { data: mandatoryHolidays } = await serviceClient
      .from('holidays')
      .select('date')
      .eq('mandatory', true)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    for (const h of mandatoryHolidays ?? []) {
      requiredDays.add(h.date)
    }

    if (requiredDays.size > 0) {
      // Conta turni per ogni giorno richiesto
      const { data: shifts } = await serviceClient
        .from('shifts')
        .select('date')
        .in('date', [...requiredDays])
        .eq('area_id', profile.area_id)

      const countByDate = new Map<string, number>()
      for (const s of shifts ?? []) {
        countByDate.set(s.date, (countByDate.get(s.date) ?? 0) + 1)
      }

      const uncovered = [...requiredDays]
        .sort()
        .filter((day) => (countByDate.get(day) ?? 0) < workersPerDay)

      if (uncovered.length > 0) {
        const fmt = (d: string) => {
          const [y, m, day] = d.split('-')
          return `${day}/${m}/${y}`
        }
        const plural = uncovered.length === 1 ? 'o' : 'i'
        return NextResponse.json(
          {
            error: `Impossibile confermare: ${uncovered.length} giorn${plural} senza copertura completa (${workersPerDay} reperibili richiesti): ${uncovered.map(fmt).join(', ')}`,
          },
          { status: 422 }
        )
      }
    }
  }

  const lockPayload =
    action === 'lock'
      ? { status: 'locked' as const, locked_by: user.id, locked_at: new Date().toISOString() }
      : { status: 'open' as const, locked_by: null, locked_at: null, email_inviata: false, email_inviata_at: null }

  // Verifica se il record esiste già (e legge lo status corrente)
  const { data: existing } = await serviceClient
    .from('month_status')
    .select('id, status')
    .eq('month', month)
    .eq('year', year)
    .eq('area_id', profile.area_id)
    .single()

  // Mese confirmed: solo admin può sbloccare
  if (action === 'unlock' && existing?.status === 'confirmed' && profile.ruolo !== 'admin') {
    return NextResponse.json(
      { error: 'Solo l\'amministratore può sbloccare un mese confermato.' },
      { status: 403 }
    )
  }

  if (existing) {
    const { error } = await serviceClient
      .from('month_status')
      .update(lockPayload)
      .eq('month', month)
      .eq('year', year)
      .eq('area_id', profile.area_id)
    if (error) {
      console.error(`Errore ${action} mese:`, error)
      return NextResponse.json({ error: 'Errore durante l\'operazione sul mese.' }, { status: 500 })
    }
  } else {
    const { error } = await serviceClient
      .from('month_status')
      .insert({ month, year, area_id: profile.area_id, ...lockPayload })
    if (error) {
      console.error(`Errore ${action} mese:`, error)
      return NextResponse.json({ error: 'Errore durante l\'operazione sul mese.' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
