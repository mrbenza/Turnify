import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateTurniExcel } from '@/lib/excel/generateTurniExcel'
import { sendTurniEmail } from '@/lib/email/sendTurniEmail'
import { resolveRequestArea } from '@/lib/utils/resolveRequestArea'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('ruolo, area_id').eq('id', user.id).single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  let body: { month?: number; year?: number; area_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { month, year, area_id: bodyAreaId } = body
  if (!month || !year) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti: month, year' }, { status: 400 })
  }

  const areaResult = resolveRequestArea(profile, bodyAreaId)
  if (areaResult instanceof NextResponse) return areaResult
  const effectiveAreaId = areaResult

  // service_role: generateTurniExcel legge shifts cross-area + UPDATE month_status
  const serviceClient = createServiceClient()

  const { data: monthStatus } = await serviceClient
    .from('month_status')
    .select('status')
    .eq('month', month)
    .eq('year', year)
    .eq('area_id', effectiveAreaId)
    .single()

  if (!monthStatus || (monthStatus.status !== 'locked' && monthStatus.status !== 'confirmed')) {
    return NextResponse.json({ error: 'Il mese non è ancora confermato' }, { status: 400 })
  }

  // Fetch destinatari in parallelo con generazione Excel (shifts già inclusi nel result)
  const [
    { data: employees },
    { data: extraEmails },
    excelResult,
  ] = await Promise.all([
    serviceClient.from('users').select('email, nome').eq('ruolo', 'dipendente').eq('attivo', true).eq('area_id', effectiveAreaId),
    serviceClient.from('email_settings').select('email, descrizione').eq('attivo', true).eq('area_id', effectiveAreaId),
    generateTurniExcel(month, year, serviceClient, undefined, effectiveAreaId),
  ])

  const recipients = [
    ...(employees ?? []).map((u: { email: string; nome: string }) => ({ email: u.email, name: u.nome })),
    ...(extraEmails ?? []).map((e: { email: string; descrizione: string | null }) => ({ email: e.email, name: e.descrizione ?? undefined })),
  ]

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Nessun destinatario configurato' }, { status: 400 })
  }

  await sendTurniEmail({
    month,
    year,
    shiftsByDate: excelResult.shiftsByDate,
    recipients,
    excelBuffer: excelResult.buffer,
    excelFileName: excelResult.fileName,
  })

  // Setta confermato + email inviata
  await serviceClient
    .from('month_status')
    .update({
      status: 'confirmed',
      email_inviata: true,
      email_inviata_at: new Date().toISOString(),
    })
    .eq('month', month)
    .eq('year', year)
    .eq('area_id', effectiveAreaId)

  return NextResponse.json({ success: true, recipients: recipients.length })
}
