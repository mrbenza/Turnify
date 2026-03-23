import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateTurniExcel } from '@/lib/excel/generateTurniExcel'
import { sendTurniEmail } from '@/lib/email/sendTurniEmail'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('ruolo').eq('id', user.id).single()
  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager')
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2020 || year > 2100)
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })

  const serviceClient = createServiceClient()

  const { data: monthStatus } = await supabase
    .from('month_status')
    .select('status, email_inviata')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (!monthStatus || (monthStatus.status !== 'locked' && monthStatus.status !== 'confirmed')) {
    return NextResponse.json(
      { error: 'Il mese deve essere confermato prima di poter esportare.' },
      { status: 403 }
    )
  }

  let buffer: Buffer
  let fileName: string
  try {
    const result = await generateTurniExcel(month, year, serviceClient, searchParams.get('template'))
    buffer = result.buffer
    fileName = result.fileName
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore generazione Excel'
    console.error('Errore generazione Excel:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Aggiorna stato post-export
  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  try {
    await serviceClient
      .from('availability')
      .update({ status: 'approved' })
      .eq('status', 'pending')
      .gte('date', from)
      .lte('date', to)

    await serviceClient
      .from('month_status')
      .update({ status: 'confirmed' })
      .eq('month', month)
      .eq('year', year)
  } catch (err) {
    console.error('Errore aggiornamento stato post-export (non bloccante):', err)
  }

  // Invia email con allegato se non ancora inviata
  if (!monthStatus?.email_inviata) {
    try {
      const [{ data: employees }, { data: extraEmails }, { data: shiftRows }, { data: users }] =
        await Promise.all([
          serviceClient.from('users').select('email, nome').eq('ruolo', 'dipendente').eq('attivo', true),
          serviceClient.from('email_settings').select('email, descrizione').eq('attivo', true),
          serviceClient.from('shifts').select('date, user_id').gte('date', from).lte('date', to).order('date'),
          serviceClient.from('users').select('id, nome'),
        ])

      const userMap = new Map<string, string>(
        (users ?? []).map((u: { id: string; nome: string }) => {
          const idx = u.nome.indexOf(' ')
          return [u.id, idx === -1 ? u.nome : u.nome.slice(idx + 1)]
        })
      )
      const shiftsByDate = new Map<string, string[]>()
      for (const s of shiftRows ?? []) {
        if (!shiftsByDate.has(s.date)) shiftsByDate.set(s.date, [])
        shiftsByDate.get(s.date)!.push(userMap.get(s.user_id) ?? s.user_id)
      }

      const recipients = [
        ...(employees ?? []).map((u: { email: string; nome: string }) => ({ email: u.email, name: u.nome })),
        ...(extraEmails ?? []).map((e: { email: string; descrizione: string | null }) => ({ email: e.email, name: e.descrizione ?? undefined })),
      ]

      await sendTurniEmail({ month, year, shiftsByDate, recipients, excelBuffer: buffer, excelFileName: fileName })

      await serviceClient
        .from('month_status')
        .update({ email_inviata: true, email_inviata_at: new Date().toISOString() })
        .eq('month', month)
        .eq('year', year)
    } catch (err) {
      console.error('Errore invio email turni (non bloccante):', err)
    }
  }

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
