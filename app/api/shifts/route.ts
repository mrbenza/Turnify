import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Shift, ShiftType } from '@/lib/supabase/types'

function isWeekendDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

export async function POST(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

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

  // Check if date is a holiday
  const { data: holiday } = await supabase
    .from('holidays')
    .select('id')
    .eq('date', date)
    .maybeSingle()

  const isHoliday = holiday !== null
  const isWeekend = isWeekendDay(year, month - 1, day)

  const shiftType: ShiftType = isHoliday ? 'festivo' : isWeekend ? 'weekend' : 'reperibilita'

  // Regola: max 1 turno speciale (weekend o festivo) per dipendente per mese
  if (shiftType === 'weekend' || shiftType === 'festivo') {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

    // Per i weekend escludiamo la coppia Sab+Dom corrente (stesso weekend = ok).
    // Se il festivo cade di sabato o domenica (es. Pasqua), escludiamo comunque
    // la coppia Sab+Dom: sabato + festivo-domenica sono lo stesso weekend.
    const dow = new Date(year, month - 1, day).getDay()
    const isWeekendDate = dow === 0 || dow === 6
    const satDay = (shiftType === 'weekend' || (shiftType === 'festivo' && isWeekendDate))
      ? (dow === 6 ? day : day - 1)
      : null
    const excludeSat = satDay !== null
      ? `${year}-${String(month).padStart(2, '0')}-${String(satDay).padStart(2, '0')}`
      : date
    const excludeSun = satDay !== null
      ? `${year}-${String(month).padStart(2, '0')}-${String(satDay + 1).padStart(2, '0')}`
      : date

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

  if (monthStatus?.status === 'locked') {
    return NextResponse.json(
      { error: 'Impossibile modificare un mese confermato.' },
      { status: 409 }
    )
  }

  // Insert shift — adminId comes from session, not from client
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      date,
      user_id,
      shift_type: shiftType,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Errore inserimento turno:', error)
    return NextResponse.json({ error: 'Errore durante l\'assegnazione del turno.' }, { status: 500 })
  }

  return NextResponse.json(data as Shift, { status: 201 })
}
