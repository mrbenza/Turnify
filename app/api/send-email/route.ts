import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendTurniEmail } from '@/lib/email/sendTurniEmail'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth: solo admin/manager
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  let body: { month?: number; year?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { month, year } = body
  if (!month || !year) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti: month, year' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Verifica che il mese sia confermato
  const { data: monthStatus } = await serviceClient
    .from('month_status')
    .select('status')
    .eq('month', month)
    .eq('year', year)
    .single()

  if (!monthStatus || (monthStatus.status !== 'locked' && monthStatus.status !== 'confirmed')) {
    return NextResponse.json({ error: 'Il mese non è ancora confermato' }, { status: 400 })
  }

  // Fetch turni del mese
  const monthStr = String(month).padStart(2, '0')
  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${year}-${monthStr}-01`
  const to = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`

  const [{ data: shifts }, { data: employees }, { data: extraEmails }] =
    await Promise.all([
      serviceClient.from('shifts').select('date, user_nome').gte('date', from).lte('date', to).order('date'),
      serviceClient.from('users').select('email, nome').eq('ruolo', 'dipendente').eq('attivo', true),
      serviceClient.from('email_settings').select('email, descrizione').eq('attivo', true),
    ])

  // Ricostruisce shiftsByDate usando user_nome (cognome già salvato nel turno)
  const shiftsByDate = new Map<string, string[]>()
  for (const s of shifts ?? []) {
    if (!shiftsByDate.has(s.date)) shiftsByDate.set(s.date, [])
    if (s.user_nome) shiftsByDate.get(s.date)!.push(s.user_nome)
  }

  const recipients = [
    ...(employees ?? []).map((u: { email: string; nome: string }) => ({ email: u.email, name: u.nome })),
    ...(extraEmails ?? []).map((e: { email: string; descrizione: string | null }) => ({ email: e.email, name: e.descrizione ?? undefined })),
  ]

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Nessun destinatario configurato' }, { status: 400 })
  }

  await sendTurniEmail({ month, year, shiftsByDate, recipients })

  await serviceClient
    .from('month_status')
    .update({ email_inviata: true, email_inviata_at: new Date().toISOString() })
    .eq('month', month)
    .eq('year', year)

  return NextResponse.json({ success: true, recipients: recipients.length })
}
