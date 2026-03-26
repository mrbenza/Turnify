import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SchedulingMode } from '@/lib/supabase/types'

const VALID_MODES: SchedulingMode[] = ['weekend_full', 'single_day', 'sun_next_sat']

async function getAuthProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, supabase }
  const { data: profile } = await supabase
    .from('users').select('ruolo, area_id').eq('id', user.id).single()
  return { user, profile, supabase }
}

export async function GET() {
  const { user, profile } = await getAuthProfile()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // service_role: PATCH usa UPDATE areas (no policy write); manteniamo coerenza nel file
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('areas')
    .select('scheduling_mode, workers_per_day')
    .eq('id', profile?.area_id)
    .single()

  if (error || !data) {
    // Riga default non ancora creata: restituisce valori di default
    return NextResponse.json({ scheduling_mode: 'weekend_full', workers_per_day: 2 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const { user, profile } = await getAuthProfile()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  let body: { scheduling_mode?: string; workers_per_day?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { scheduling_mode, workers_per_day } = body

  if (scheduling_mode !== undefined && !VALID_MODES.includes(scheduling_mode as SchedulingMode)) {
    return NextResponse.json({ error: 'scheduling_mode non valido' }, { status: 400 })
  }
  if (workers_per_day !== undefined && workers_per_day !== 1 && workers_per_day !== 2) {
    return NextResponse.json({ error: 'workers_per_day deve essere 1 o 2' }, { status: 400 })
  }

  // service_role: UPDATE areas — la tabella non ha policy write nel DB
  const serviceClient = createServiceClient()

  // Leggi ID della riga area dell'utente
  const { data: existing } = await serviceClient
    .from('areas').select('id').eq('id', profile?.area_id).single()

  if (!existing) {
    return NextResponse.json({ error: 'Configurazione non trovata' }, { status: 404 })
  }

  const patch: Record<string, unknown> = {}
  if (scheduling_mode !== undefined) patch.scheduling_mode = scheduling_mode
  if (workers_per_day !== undefined) patch.workers_per_day = workers_per_day

  const { error } = await serviceClient
    .from('areas').update(patch).eq('id', existing.id)

  if (error) {
    console.error('Errore aggiornamento config:', error)
    return NextResponse.json({ error: 'Errore durante il salvataggio' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
