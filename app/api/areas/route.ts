import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SchedulingMode } from '@/lib/supabase/types'

const VALID_MODES: SchedulingMode[] = ['weekend_full', 'single_day', 'sun_next_sat']

async function getAuthProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('users').select('ruolo, area_id').eq('id', user.id).single()
  return { user, profile }
}

/**
 * GET /api/areas
 * Lista tutte le aree. Richiede ruolo admin o manager.
 */
export async function GET() {
  const { user, profile } = await getAuthProfile()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('areas')
    .select('*')
    .order('nome', { ascending: true })

  if (error) {
    console.error('Errore lettura aree:', error)
    return NextResponse.json({ error: 'Errore durante il recupero delle aree' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/areas
 * Crea una nuova area. Richiede ruolo admin.
 * Body: { nome: string, scheduling_mode?: SchedulingMode, workers_per_day?: 1|2 }
 */
export async function POST(request: Request) {
  const { user, profile } = await getAuthProfile()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato — richiesto ruolo admin' }, { status: 403 })
  }

  let body: { nome?: unknown; scheduling_mode?: unknown; workers_per_day?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  if (!nome) {
    return NextResponse.json({ error: 'Il campo "nome" è obbligatorio' }, { status: 400 })
  }

  const scheduling_mode = body.scheduling_mode ?? 'weekend_full'
  if (!VALID_MODES.includes(scheduling_mode as SchedulingMode)) {
    return NextResponse.json({ error: 'scheduling_mode non valido' }, { status: 400 })
  }

  const workers_per_day = body.workers_per_day ?? 1
  if (workers_per_day !== 1 && workers_per_day !== 2) {
    return NextResponse.json({ error: 'workers_per_day deve essere 1 o 2' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('areas')
    .insert({
      nome,
      scheduling_mode: scheduling_mode as SchedulingMode,
      workers_per_day: workers_per_day as 1 | 2,
      template_path: null,
      manager_id: null,
    })
    .select()
    .single()

  if (error) {
    console.error('Errore creazione area:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Esiste già un\'area con questo nome' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Errore durante la creazione dell\'area' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
