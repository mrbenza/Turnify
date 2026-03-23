import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Shift, ShiftType } from '@/lib/supabase/types'

function isWeekendDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

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
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // Parse body
  let body: { date?: string; user_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { date, user_id } = body

  if (!date || !user_id) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti: date, user_id' }, { status: 400 })
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Formato data non valido. Atteso: YYYY-MM-DD' }, { status: 400 })
  }

  // Determine shift type from date
  const [year, month, day] = date.split('-').map(Number)

  // Leggi config area (scheduling_mode, workers_per_day)
  const { data: areaConfig } = await supabase
    .from('areas')
    .select('scheduling_mode, workers_per_day')
    .limit(1)
    .single()
  const schedulingMode = areaConfig?.scheduling_mode ?? 'weekend_full'
  const workersPerDay = areaConfig?.workers_per_day ?? 2

  // Check if date is a holiday
  const { data: holiday } = await supabase
    .from('holidays')
    .select('id, mandatory')
    .eq('date', date)
    .maybeSingle()

  const isHoliday = holiday !== null && holiday.mandatory === true
  const isWeekend = isWeekendDay(year, month - 1, day)

  const shiftType: ShiftType = isHoliday ? 'festivo' : isWeekend ? 'weekend' : 'reperibilita'

  // Check workers_per_day: max N persone per giorno
  if (workersPerDay === 1) {
    const { data: existingForDay } = await supabase
      .from('shifts')
      .select('id')
      .eq('date', date)
      .limit(1)
    if (existingForDay && existingForDay.length > 0) {
      return NextResponse.json(
        { error: 'Giorno già coperto (max 1 reperibile per giorno).' },
        { status: 409 }
      )
    }
  }

  // Regola: max 1 turno speciale (weekend o festivo) per dipendente per mese
  if (shiftType === 'weekend' || shiftType === 'festivo') {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

    const dow = new Date(year, month - 1, day).getDay() // 0=Dom, 6=Sab
    const isWeekendDate = dow === 0 || dow === 6
    const isHolidayOnWeekend = isHoliday && isWeekendDate

    // Calcola la coppia da escludere in base allo scheduling_mode
    let excludeSat: string
    let excludeSun: string

    if (isHolidayOnWeekend || schedulingMode === 'weekend_full') {
      // Festivo su weekend (tutti i modi) o weekend_full: coppia Sab+Dom stessa settimana
      const satDay = dow === 6 ? day : day - 1
      excludeSat = `${year}-${String(month).padStart(2, '0')}-${String(satDay).padStart(2, '0')}`
      excludeSun = `${year}-${String(month).padStart(2, '0')}-${String(satDay + 1).padStart(2, '0')}`
    } else if (schedulingMode === 'sun_next_sat' && isWeekendDate) {
      if (dow === 0) {
        // Dom: coppia = Dom + Sab+7
        excludeSun = date
        const nextSat = new Date(year, month - 1, day + 7)
        excludeSat = `${nextSat.getFullYear()}-${String(nextSat.getMonth() + 1).padStart(2, '0')}-${String(nextSat.getDate()).padStart(2, '0')}`
      } else {
        // Sab: coppia = Dom-7 + Sab
        excludeSat = date
        const prevSun = new Date(year, month - 1, day - 7)
        excludeSun = `${prevSun.getFullYear()}-${String(prevSun.getMonth() + 1).padStart(2, '0')}-${String(prevSun.getDate()).padStart(2, '0')}`
      }
    } else {
      // single_day o festivo feriale: esclude solo la data stessa
      excludeSat = date
      excludeSun = date
    }

    const { data: conflict } = await supabase
      .from('shifts')
      .select('date')
      .eq('user_id', user_id)
      .in('shift_type', ['weekend', 'festivo'])
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .neq('date', excludeSat)
      .neq('date', excludeSun)
      .limit(1)

    if (conflict && conflict.length > 0) {
      return NextResponse.json(
        { error: 'Dipendente già assegnato a un turno speciale questo mese.' },
        { status: 409 }
      )
    }
  }

  // Blocco: mese locked non modificabile
  const { data: monthStatus } = await supabase
    .from('month_status')
    .select('status')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (monthStatus?.status === 'locked' || monthStatus?.status === 'confirmed') {
    return NextResponse.json(
      { error: 'Impossibile modificare un mese confermato.' },
      { status: 409 }
    )
  }

  // Fetch nome dipendente per denormalizzarlo nel turno
  const { data: targetUser } = await supabase
    .from('users')
    .select('nome')
    .eq('id', user_id)
    .single()

  // Insert shift — adminId comes from session, not from client
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      date,
      user_id,
      user_nome: targetUser?.nome ?? null,
      shift_type: shiftType,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Errore inserimento turno:', error)
    return NextResponse.json({ error: 'Errore durante l\'assegnazione del turno.' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
