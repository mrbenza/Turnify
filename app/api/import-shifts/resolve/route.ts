import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ShiftType } from '@/lib/supabase/types'

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
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('ruolo, area_id').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profile?.ruolo ?? ''))
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  if (profile?.ruolo === 'manager' && !profile.area_id)
    return NextResponse.json({ error: 'Profilo manager non configurato: area mancante.' }, { status: 403 })

  let body: { user_id?: string; user_nome?: string; area_id?: string; shifts?: { date: string; shift_type: ShiftType; reperibile_order?: 1 | 2 }[] }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { user_id, user_nome, shifts } = body
  if (!user_id || !user_nome || !shifts?.length)
    return NextResponse.json({ error: 'Campi obbligatori mancanti: user_id, user_nome, shifts' }, { status: 400 })

  // Manager usa sempre la propria area; admin usa l'area_id passata dal frontend
  const areaId: string | undefined = profile?.ruolo === 'manager'
    ? profile.area_id!
    : (typeof body.area_id === 'string' && body.area_id) ? body.area_id : (profile?.area_id ?? undefined)

  if (!areaId)
    return NextResponse.json({ error: 'area_id obbligatorio' }, { status: 400 })

  // service_role: UPDATE shifts cross-area per risoluzione conflitti (admin)
  const serviceClient = createServiceClient()

  // Blocco immutabilità: rifiuta se qualsiasi mese coinvolto è locked o confirmed
  const { data: lockedStatuses } = await serviceClient
    .from('month_status')
    .select('month, year, status')
    .eq('area_id', areaId)
    .in('status', ['locked', 'confirmed'])

  if (lockedStatuses && lockedStatuses.length > 0) {
    const lockedSet = new Set<string>(
      lockedStatuses.map((ms) => `${ms.year}-${String(ms.month).padStart(2, '0')}`)
    )
    const blocked = [...new Set(
      shifts
        .map((s) => s.date.slice(0, 7))
        .filter((ym) => lockedSet.has(ym))
    )]
    if (blocked.length > 0) {
      const fmt = (ym: string) => { const [y, m] = ym.split('-'); return `${m}/${y}` }
      return NextResponse.json(
        { error: `Impossibile risolvere: i mesi ${blocked.map(fmt).join(', ')} sono già bloccati/confermati. Sblocca prima di procedere.` },
        { status: 422 }
      )
    }
  }

  const toInsert = shifts.map((s) => ({
    date: s.date,
    user_id,
    user_nome,
    shift_type: s.shift_type,
    reperibile_order: s.reperibile_order ?? 1,
    created_by: user.id,
    area_id: areaId,
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
