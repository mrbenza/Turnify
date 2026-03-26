import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MONTH_NAMES_IT = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
]

export type StoricoShift = {
  date: string
  shift_type: 'weekend' | 'festivo' | 'reperibilita'
  holiday_name: string | null
  holiday_mandatory: boolean
}

export type StoricoMese = {
  month: number
  year: number
  label: string
  totale: number
  festivi: number
}

export type StoricoDipendente = {
  nome: string
  area_id: string
  shifts: StoricoShift[]
  byMonth: StoricoMese[]
  byHoliday: { name: string; count: number; mandatory: boolean }[]
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', authUser.id)
    .single()

  if (profile?.ruolo !== 'admin' && profile?.ruolo !== 'manager') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { id } = await params
  const serviceClient = createServiceClient()

  // Verifica che il target appartenga all'area del caller (se manager)
  if (profile?.ruolo !== 'admin') {
    const { data: callerProfile } = await supabase
      .from('users')
      .select('area_id')
      .eq('id', authUser.id)
      .single()
    const { data: targetProfile } = await serviceClient
      .from('users')
      .select('area_id')
      .eq('id', id)
      .single()
    if (!targetProfile || targetProfile.area_id !== callerProfile?.area_id) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 })
    }
  }

  const [{ data: target }, { data: rawShifts }] = await Promise.all([
    serviceClient.from('users').select('nome, area_id').eq('id', id).single(),
    serviceClient.from('shifts').select('date, shift_type, area_id').eq('user_id', id).order('date'),
  ])

  if (!target) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })

  // Recupera festività per le date con shift_type = festivo
  const festivoDates = (rawShifts ?? [])
    .filter(s => s.shift_type === 'festivo')
    .map(s => s.date)

  let holidayMap = new Map<string, { name: string; mandatory: boolean }>()
  if (festivoDates.length > 0) {
    const { data: holidays } = await serviceClient
      .from('holidays')
      .select('date, name, mandatory')
      .in('date', festivoDates)
    for (const h of holidays ?? []) {
      holidayMap.set(h.date, { name: h.name, mandatory: h.mandatory })
    }
  }

  // Costruisce lista shift arricchita
  const shifts: StoricoShift[] = (rawShifts ?? []).map(s => {
    const hol = s.shift_type === 'festivo' ? holidayMap.get(s.date) : undefined
    return {
      date: s.date,
      shift_type: s.shift_type as StoricoShift['shift_type'],
      holiday_name: hol?.name ?? null,
      holiday_mandatory: hol?.mandatory ?? false,
    }
  })

  // Raggruppa per mese
  const monthMap = new Map<string, StoricoMese>()
  for (const s of shifts) {
    const [y, m] = s.date.split('-').map(Number)
    const key = `${y}-${m}`
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        month: m, year: y,
        label: `${MONTH_NAMES_IT[m - 1]} ${y}`,
        totale: 0, festivi: 0,
      })
    }
    const entry = monthMap.get(key)!
    entry.totale++
    if (s.shift_type === 'festivo') entry.festivi++
  }
  const byMonth = Array.from(monthMap.values())

  // Raggruppa per festività
  const holCountMap = new Map<string, { count: number; mandatory: boolean }>()
  for (const s of shifts) {
    if (s.shift_type === 'festivo' && s.holiday_name) {
      const existing = holCountMap.get(s.holiday_name)
      if (existing) existing.count++
      else holCountMap.set(s.holiday_name, { count: 1, mandatory: s.holiday_mandatory })
    }
  }
  const byHoliday = Array.from(holCountMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)

  const result: StoricoDipendente = {
    nome: target.nome,
    area_id: target.area_id,
    shifts: shifts.reverse(), // più recenti prima
    byMonth,
    byHoliday,
  }

  return NextResponse.json(result)
}
