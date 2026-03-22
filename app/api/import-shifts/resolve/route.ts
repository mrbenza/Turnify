import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/import-shifts/resolve
 *
 * Inserisce i turni storici per un dipendente appena creato, bypassando il lock
 * del mese tramite il service client. Da invocare subito dopo la creazione utente
 * per risolvere i turni rimasti in sospeso durante un'importazione storica.
 *
 * Body: { user_id: string, user_nome: string, shifts: { date: string, shift_type: string }[] }
 * Returns: { inserted: number }
 */
export async function POST(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('ruolo').eq('id', user.id).single()
  if (profile?.ruolo !== 'admin')
    return NextResponse.json({ error: 'Solo l\'amministratore può eseguire questa operazione.' }, { status: 403 })

  let body: { user_id?: string; user_nome?: string; shifts?: { date: string; shift_type: string }[] }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { user_id, user_nome, shifts } = body
  if (!user_id || !user_nome || !shifts?.length)
    return NextResponse.json({ error: 'Campi obbligatori mancanti: user_id, user_nome, shifts' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = createServiceClient() as any

  const toInsert = shifts.map((s) => ({
    date: s.date,
    user_id,
    user_nome,
    shift_type: s.shift_type,
    created_by: user.id,
  }))

  const { data, error } = await serviceClient
    .from('shifts')
    .upsert(toInsert, { onConflict: 'date,user_id', ignoreDuplicates: true })
    .select()

  if (error) {
    console.error('Errore resolve shifts:', error)
    return NextResponse.json({ error: 'Errore inserimento turni' }, { status: 500 })
  }

  return NextResponse.json({ inserted: data?.length ?? 0 })
}
