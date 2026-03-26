import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check — user_id comes from session, not from body
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('area_id')
    .eq('id', user.id)
    .single()

  if (!userProfile?.area_id) {
    return NextResponse.json({ error: 'Profilo utente non trovato.' }, { status: 403 })
  }

  const areaId = userProfile.area_id

  // Parse body
  let body: { date?: string; available?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { date, available } = body

  if (!date || available === undefined) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti: date, available' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Formato data non valido. Atteso: YYYY-MM-DD' }, { status: 400 })
  }

  const parsed = new Date(date)
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return NextResponse.json({ error: 'Data non valida.' }, { status: 400 })
  }

  if (typeof available !== 'boolean') {
    return NextResponse.json({ error: 'Il campo available deve essere un booleano' }, { status: 400 })
  }

  // Validazione range anno: solo anni ragionevoli
  const dateYear = parseInt(date.split('-')[0])
  const currentYear = new Date().getFullYear()
  if (dateYear < currentYear || dateYear > currentYear + 2) {
    return NextResponse.json(
      { error: 'Data fuori dal range consentito.' },
      { status: 400 }
    )
  }

  // Blocco: mese locked — vale sia per nuove righe che per aggiornamenti
  const dateMonth = parseInt(date.split('-')[1])
  const { data: monthStatus } = await supabase
    .from('month_status')
    .select('status')
    .eq('month', dateMonth)
    .eq('year', dateYear)
    .eq('area_id', areaId)
    .maybeSingle()

  if (monthStatus?.status === 'locked') {
    return NextResponse.json(
      { error: 'La disponibilità non è modificabile per un mese confermato.' },
      { status: 403 }
    )
  }

  // Check if a row already exists for this (user_id, date)
  const { data: existing, error: fetchError } = await supabase
    .from('availability')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  if (fetchError) {
    console.error('Errore fetch disponibilità:', fetchError)
    return NextResponse.json({ error: 'Errore durante la lettura della disponibilità.' }, { status: 500 })
  }

  if (existing) {
    // Cannot modify if status is locked or approved
    if (existing.status === 'locked' || existing.status === 'approved') {
      return NextResponse.json(
        { error: 'La disponibilità non è modificabile per questo giorno.' },
        { status: 403 }
      )
    }

    // Update existing row
    const { data, error } = await supabase
      .from('availability')
      .update({ available })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Errore aggiornamento disponibilità:', error)
      return NextResponse.json({ error: 'Errore durante l\'aggiornamento della disponibilità.' }, { status: 500 })
    }

    return NextResponse.json(data)
  } else {
    // Insert new row with status pending
    const { data, error } = await supabase
      .from('availability')
      .insert({
        user_id: user.id,
        date,
        available,
        status: 'pending',
        area_id: areaId,
      })
      .select()
      .single()

    if (error) {
      console.error('Errore inserimento disponibilità:', error)
      return NextResponse.json({ error: 'Errore durante il salvataggio della disponibilità.' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  }
}
