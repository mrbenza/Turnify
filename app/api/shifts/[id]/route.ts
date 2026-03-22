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
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'ID turno mancante' }, { status: 400 })
  }

  // Recupera il turno per verificare la data
  const { data: existingShift } = await supabase
    .from('shifts')
    .select('date')
    .eq('id', id)
    .maybeSingle()

  if (existingShift) {
    const shiftDate = new Date(existingShift.date)
    const shiftMonth = shiftDate.getUTCMonth() + 1
    const shiftYear = shiftDate.getUTCFullYear()

    const { data: monthStatus } = await supabase
      .from('month_status')
      .select('status')
      .eq('month', shiftMonth)
      .eq('year', shiftYear)
      .maybeSingle()

    if (monthStatus?.status === 'locked') {
      return NextResponse.json(
        { error: 'Impossibile modificare un mese confermato.' },
        { status: 409 }
      )
    }
  }

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Errore rimozione turno:', error)
    return NextResponse.json({ error: 'Errore durante la rimozione del turno.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
