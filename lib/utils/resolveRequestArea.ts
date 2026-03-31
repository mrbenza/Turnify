import { NextResponse } from 'next/server'

type Profile = { ruolo: string; area_id: string | null }

/**
 * Risolve l'area_id effettiva per le route area-scoped.
 *
 * - Admin: non appartiene a nessuna area → deve specificare area_id nella
 *   request (body o query param). Se manca → 400.
 * - Manager: usa sempre la propria area dal profilo. Il requestedAreaId
 *   viene ignorato.
 *
 * Uso nelle route:
 *   const result = resolveRequestArea(profile, bodyAreaId)
 *   if (result instanceof NextResponse) return result
 *   const effectiveAreaId = result
 */
export function resolveRequestArea(
  profile: Profile,
  requestedAreaId: string | null | undefined
): string | NextResponse {
  if (profile.ruolo === 'admin') {
    if (!requestedAreaId) {
      return NextResponse.json(
        { error: 'Parametro obbligatorio mancante: area_id' },
        { status: 400 }
      )
    }
    return requestedAreaId
  }

  // Manager e altri ruoli: usa l'area del profilo
  if (!profile.area_id) {
    return NextResponse.json(
      { error: 'Profilo non configurato: area mancante.' },
      { status: 403 }
    )
  }
  return profile.area_id
}
