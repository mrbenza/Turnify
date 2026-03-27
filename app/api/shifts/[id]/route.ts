import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if (profile.ruolo === 'manager' && !profile.area_id) {
    return NextResponse.json({ error: 'Profilo manager non configurato: area mancante.' }, { status: 403 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'ID turno mancante' }, { status: 400 })
  }

  // Recupera il turno per verificare la data (filtra area per evitare info disclosure cross-area)
  const shiftQuery = supabase.from('shifts').select('date, area_id').eq('id', id)
  const { data: existingShift } = await (
    profile.ruolo !== 'admin'
      ? shiftQuery.eq('area_id', profile.area_id)
      : shiftQuery
  ).maybeSingle()

  if (existingShift) {
    const shiftDate = new Date(existingShift.date)
    const shiftMonth = shiftDate.getUTCMonth() + 1
    const shiftYear = shiftDate.getUTCFullYear()
    // Per admin usa l'area_id del turno stesso (l'admin non ha area propria)
    const effectiveAreaId = profile.ruolo === 'admin' ? existingShift.area_id : profile.area_id

    const { data: monthStatus } = await supabase
      .from('month_status')
      .select('status')
      .eq('month', shiftMonth)
      .eq('year', shiftYear)
      .eq('area_id', effectiveAreaId)
      .maybeSingle()

    if (monthStatus?.status === 'locked' || monthStatus?.status === 'confirmed') {
      return NextResponse.json(
        { error: 'Impossibile modificare un mese confermato.' },
        { status: 409 }
      )
    }
  }

  // Filtra anche per area_id: un manager non può eliminare turni di altre aree
  const deleteQuery = supabase.from('shifts').delete().eq('id', id)
  const finalDelete = profile.ruolo !== 'admin'
    ? deleteQuery.eq('area_id', profile.area_id)
    : deleteQuery
  const { error } = await finalDelete

  if (error) {
    console.error('Errore rimozione turno:', error)
    return NextResponse.json({ error: 'Errore durante la rimozione del turno.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
