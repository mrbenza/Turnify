import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/areas/switch
 *
 * Imposta il cookie `active_area_id` per il manager autenticato.
 * Verifica che il manager abbia accesso all'area richiesta
 * (area_id nel suo profilo OPPURE area con manager_id = user.id).
 * L'admin può passare a qualsiasi area.
 *
 * Body: { area_id: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, area_id')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  let body: { area_id?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const area_id = typeof body.area_id === 'string' ? body.area_id.trim() : ''
  if (!area_id) return NextResponse.json({ error: 'area_id obbligatorio' }, { status: 400 })

  // Admin: accede a qualsiasi area senza verifica
  if (profile.ruolo === 'manager') {
    // Il manager può accedere alla propria area o alle aree di cui è manager
    const isHomeArea = profile.area_id === area_id
    const { data: managedArea } = await supabase
      .from('areas')
      .select('id')
      .eq('id', area_id)
      .eq('manager_id', user.id)
      .maybeSingle()

    if (!isHomeArea && !managedArea) {
      return NextResponse.json({ error: 'Area non accessibile' }, { status: 403 })
    }
  }

  const cookieStore = await cookies()
  cookieStore.set('active_area_id', area_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
