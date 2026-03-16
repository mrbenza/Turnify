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

  if (profile?.ruolo !== 'admin') {
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
