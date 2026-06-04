import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateTurniExcel } from '@/lib/excel/generateTurniExcel'
import { resolveRequestArea } from '@/lib/utils/resolveRequestArea'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('ruolo, area_id').eq('id', user.id).single()
  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager')
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month   = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year    = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const areaResult = resolveRequestArea(profile, searchParams.get('area_id'))
  if (areaResult instanceof NextResponse) return areaResult
  const effectiveAreaId = areaResult

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2020 || year > 2100)
    return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })

  // service_role: generateTurniExcel legge shifts/users cross-area + upload storage
  const serviceClient = createServiceClient()

  const { data: monthStatus } = await supabase
    .from('month_status')
    .select('status')
    .eq('month', month)
    .eq('year', year)
    .eq('area_id', effectiveAreaId)
    .maybeSingle()

  if (monthStatus?.status !== 'confirmed') {
    return NextResponse.json(
      { error: 'Il mese deve essere confermato definitivamente prima di poter esportare.' },
      { status: 403 }
    )
  }

  let buffer: Buffer
  let fileName: string
  try {
    const result = await generateTurniExcel(month, year, serviceClient, searchParams.get('template'), effectiveAreaId)
    buffer = result.buffer
    fileName = result.fileName
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore generazione Excel'
    console.error('Errore generazione Excel:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
