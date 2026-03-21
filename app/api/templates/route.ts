import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  /* ---- Auth check ---- */
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  /* ---- Admin-only: manager non autorizzato ---- */
  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Solo l\'amministratore può caricare i template.' }, { status: 403 })
  }

  /* ---- Read FormData ---- */
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Body non valido — FormData atteso.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Nessun file ricevuto.' }, { status: 400 })
  }

  /* ---- Validate .xlsx ---- */
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (
    !file.name.endsWith('.xlsx') ||
    (file.type && file.type !== XLSX_MIME && file.type !== 'application/octet-stream')
  ) {
    return NextResponse.json(
      { error: 'Il file deve essere in formato .xlsx.' },
      { status: 400 }
    )
  }

  /* ---- Convert to ArrayBuffer ---- */
  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: 'Errore nella lettura del file.' }, { status: 500 })
  }

  /* ---- Upload to Supabase Storage ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = createServiceClient() as any
  const { error: storageError } = await serviceClient.storage
    .from('templates')
    .upload(file.name, buffer, {
      upsert: true,
      contentType: XLSX_MIME,
    })

  if (storageError) {
    console.error('Errore upload Supabase Storage:', storageError)
    return NextResponse.json(
      { error: 'Errore durante il salvataggio del template.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, name: file.name })
}
