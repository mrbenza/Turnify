import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SchedulingMode } from '@/lib/supabase/types'

const VALID_MODES: SchedulingMode[] = ['weekend_full', 'single_day', 'sun_next_sat']

async function getAuthProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('users').select('ruolo').eq('id', user.id).single()
  return { user, profile }
}

/**
 * PATCH /api/areas/[id]
 * Aggiorna un'area esistente. Richiede ruolo admin.
 * Body: { nome?: string, scheduling_mode?: SchedulingMode, workers_per_day?: 1|2, manager_id?: string|null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthProfile()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato — richiesto ruolo admin' }, { status: 403 })
  }

  const { id } = await params

  let body: { nome?: unknown; scheduling_mode?: unknown; workers_per_day?: unknown; manager_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (body.nome !== undefined) {
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
    if (!nome) return NextResponse.json({ error: 'Il campo "nome" non può essere vuoto' }, { status: 400 })
    patch.nome = nome
  }

  if (body.scheduling_mode !== undefined) {
    if (!VALID_MODES.includes(body.scheduling_mode as SchedulingMode)) {
      return NextResponse.json({ error: 'scheduling_mode non valido' }, { status: 400 })
    }
    patch.scheduling_mode = body.scheduling_mode
  }

  if (body.workers_per_day !== undefined) {
    if (body.workers_per_day !== 1 && body.workers_per_day !== 2) {
      return NextResponse.json({ error: 'workers_per_day deve essere 1 o 2' }, { status: 400 })
    }
    patch.workers_per_day = body.workers_per_day
  }

  const newManagerId = body.manager_id !== undefined
    ? (body.manager_id === null ? null : String(body.manager_id))
    : undefined

  if (newManagerId !== undefined) {
    patch.manager_id = newManagerId
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Se stiamo cambiando manager, gestiamo il trasferimento in cascata
  if (newManagerId !== undefined) {
    // Leggi il manager attuale di quest'area
    const { data: currentArea } = await serviceClient
      .from('areas')
      .select('manager_id')
      .eq('id', id)
      .single()

    const oldManagerId = currentArea?.manager_id ?? null

    if (newManagerId !== null && newManagerId !== oldManagerId) {
      // Togli il nuovo manager dall'area in cui è eventualmente manager ora
      await serviceClient
        .from('areas')
        .update({ manager_id: null })
        .eq('manager_id', newManagerId)
        .neq('id', id)

      // Sposta il nuovo manager in quest'area
      await serviceClient
        .from('users')
        .update({ area_id: id })
        .eq('id', newManagerId)
    }
  }

  const { data, error } = await serviceClient
    .from('areas')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Errore aggiornamento area:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Esiste già un\'area con questo nome' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento dell\'area' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Area non trovata' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * DELETE /api/areas/[id]
 * Elimina un'area. Richiede ruolo admin.
 * Non permette l'eliminazione se nome === 'Default' o se ci sono entità collegate.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthProfile()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato — richiesto ruolo admin' }, { status: 403 })
  }

  const { id } = await params
  const serviceClient = createServiceClient()

  // Controlla che l'area esista e non sia 'Default'
  const { data: area, error: areaError } = await serviceClient
    .from('areas')
    .select('id, nome')
    .eq('id', id)
    .single()

  if (areaError || !area) {
    return NextResponse.json({ error: 'Area non trovata' }, { status: 404 })
  }

  if (area.nome === 'Default') {
    return NextResponse.json({ error: 'L\'area "Default" non può essere eliminata' }, { status: 409 })
  }

  // Controlla utenti collegati
  const { count: usersCount } = await serviceClient
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('area_id', id)

  if ((usersCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Impossibile eliminare: ci sono ${usersCount} utenti in questa area` },
      { status: 409 }
    )
  }

  // Controlla shifts collegati
  const { count: shiftsCount } = await serviceClient
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .eq('area_id', id)

  if ((shiftsCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Impossibile eliminare: ci sono ${shiftsCount} turni in questa area` },
      { status: 409 }
    )
  }

  // Controlla availability collegati
  const { count: availabilityCount } = await serviceClient
    .from('availability')
    .select('id', { count: 'exact', head: true })
    .eq('area_id', id)

  if ((availabilityCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Impossibile eliminare: ci sono ${availabilityCount} disponibilità in questa area` },
      { status: 409 }
    )
  }

  // Controlla month_status collegati
  const { count: monthStatusCount } = await serviceClient
    .from('month_status')
    .select('id', { count: 'exact', head: true })
    .eq('area_id', id)

  if ((monthStatusCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Impossibile eliminare: ci sono ${monthStatusCount} stati mese in questa area` },
      { status: 409 }
    )
  }

  const { error: deleteError } = await serviceClient
    .from('areas')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('Errore eliminazione area:', deleteError)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione dell\'area' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
