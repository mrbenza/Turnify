import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type DebugAction = 'summary' | 'listUsers' | 'getUserById' | 'batchGetUserById' | 'batchGetUserByIdSequential' | 'batchGetUserByIdLimited'

type AppUserRow = {
  id: string
  email: string
  ruolo: string
  area_id: string | null
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function formatAuthError(error: { name: string; message: string; status?: number } | null) {
  if (!error) return null
  return {
    name: error.name,
    message: error.message,
    status: 'status' in error ? error.status ?? null : null,
  }
}

async function loadScopedUsers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ruolo: string,
  areaId: string | null,
  limit: number,
  offset: number
) {
  let usersQuery = supabase
    .from('users')
    .select('id, email, ruolo, area_id', { count: 'exact' })
    .order('nome', { ascending: true })
    .range(offset, offset + limit - 1)

  if (ruolo === 'admin') {
    usersQuery = usersQuery.neq('ruolo', 'admin')
  } else {
    usersQuery = usersQuery.eq('ruolo', 'dipendente').eq('area_id', areaId)
  }

  return usersQuery
}

async function fetchOneUser(serviceClient: ReturnType<typeof createServiceClient>, appUser: AppUserRow) {
  const { data, error } = await serviceClient.auth.admin.getUserById(appUser.id)
  return {
    id: appUser.id,
    email: appUser.email,
    ruolo: appUser.ruolo,
    area_id: appUser.area_id,
    ok: !error,
    error: formatAuthError(error),
    auth_email: data?.user?.email ?? null,
    last_sign_in_at: data?.user?.last_sign_in_at ?? null,
  }
}

async function fetchUsersLimited(serviceClient: ReturnType<typeof createServiceClient>, appUsers: AppUserRow[], concurrency: number) {
  const results: Awaited<ReturnType<typeof fetchOneUser>>[] = []
  let index = 0

  async function worker() {
    while (index < appUsers.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await fetchOneUser(serviceClient, appUsers[currentIndex])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, appUsers.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo, area_id')
    .eq('id', user.id)
    .single<{ ruolo: string; area_id: string | null }>()

  if (profile?.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const url = new URL(request.url)
  const action = (url.searchParams.get('action') ?? 'summary') as DebugAction
  const perPage = parsePositiveInt(url.searchParams.get('perPage'), 25)
  const page = parsePositiveInt(url.searchParams.get('page'), 1)
  const limit = parsePositiveInt(url.searchParams.get('limit'), 25)
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'))
  const concurrency = parsePositiveInt(url.searchParams.get('concurrency'), 3)
  const userId = url.searchParams.get('userId')?.trim() || user.id

  const serviceClient = createServiceClient()

  if (action === 'getUserById') {
    const { data, error } = await serviceClient.auth.admin.getUserById(userId)

    return NextResponse.json({
      viewer: {
        id: user.id,
        ruolo: profile.ruolo,
        area_id: profile.area_id,
      },
      request: { action, userId },
      service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      result: {
        ok: !error,
        error: formatAuthError(error),
        user: data?.user
          ? {
              id: data.user.id,
              email: data.user.email,
              created_at: data.user.created_at ?? null,
              last_sign_in_at: data.user.last_sign_in_at ?? null,
            }
          : null,
      },
    })
  }

  if (action === 'listUsers') {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })

    return NextResponse.json({
      viewer: {
        id: user.id,
        ruolo: profile.ruolo,
        area_id: profile.area_id,
      },
      request: { action, page, perPage },
      service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      result: {
        ok: !error,
        error: formatAuthError(error),
        auth_user_count: data?.users.length ?? 0,
        total: data?.total ?? null,
        next_page: data?.nextPage ?? null,
        last_page: data?.lastPage ?? null,
        sample: (data?.users ?? []).slice(0, 20).map((authUser) => ({
          id: authUser.id,
          email: authUser.email,
          last_sign_in_at: authUser.last_sign_in_at ?? null,
        })),
      },
    })
  }

  if (action === 'batchGetUserById' || action === 'batchGetUserByIdSequential' || action === 'batchGetUserByIdLimited') {
    const startedAt = Date.now()
    const { data: appUsers, count, error: appUsersError } = await loadScopedUsers(
      supabase,
      profile.ruolo,
      profile.area_id,
      limit,
      offset
    )

    if (appUsersError) {
      return NextResponse.json({
        viewer: {
          id: user.id,
          ruolo: profile.ruolo,
          area_id: profile.area_id,
        },
        request: { action, limit, offset, concurrency },
        service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        result: {
          ok: false,
          error: {
            message: appUsersError.message,
          },
        },
      })
    }

    const users = (appUsers ?? []) as AppUserRow[]
    let rows: Awaited<ReturnType<typeof fetchOneUser>>[] = []

    if (action === 'batchGetUserByIdSequential') {
      for (const appUser of users) {
        rows.push(await fetchOneUser(serviceClient, appUser))
      }
    } else if (action === 'batchGetUserByIdLimited') {
      rows = await fetchUsersLimited(serviceClient, users, concurrency)
    } else {
      rows = await Promise.all(users.map((appUser) => fetchOneUser(serviceClient, appUser)))
    }

    const elapsedMs = Date.now() - startedAt
    const okCount = rows.filter((row) => row.ok).length

    return NextResponse.json({
      viewer: {
        id: user.id,
        ruolo: profile.ruolo,
        area_id: profile.area_id,
      },
      request: { action, limit, offset, concurrency },
      service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      result: {
        ok: true,
        total_users_matching_scope: count ?? null,
        fetched_from_public_users: rows.length,
        get_user_by_id_ok: okCount,
        get_user_by_id_failed: rows.length - okCount,
        elapsed_ms: elapsedMs,
        rows,
      },
    })
  }

  const { data: page25Data, error: page25Error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 25 })
  const { data: page50Data, error: page50Error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 50 })
  const { data: page75Data, error: page75Error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 75 })
  const { data: viewerAuthData, error: viewerAuthError } = await serviceClient.auth.admin.getUserById(user.id)

  return NextResponse.json({
    viewer: {
      id: user.id,
      ruolo: profile.ruolo,
      area_id: profile.area_id,
    },
    request: { action: 'summary' },
    service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    get_user_by_id: {
      ok: !viewerAuthError,
      error: formatAuthError(viewerAuthError),
      user: viewerAuthData?.user
        ? {
            id: viewerAuthData.user.id,
            email: viewerAuthData.user.email,
            last_sign_in_at: viewerAuthData.user.last_sign_in_at ?? null,
          }
        : null,
    },
    list_users: {
      page_25: {
        ok: !page25Error,
        error: formatAuthError(page25Error),
        auth_user_count: page25Data?.users.length ?? 0,
        total: page25Data?.total ?? null,
        next_page: page25Data?.nextPage ?? null,
      },
      page_50: {
        ok: !page50Error,
        error: formatAuthError(page50Error),
        auth_user_count: page50Data?.users.length ?? 0,
        total: page50Data?.total ?? null,
        next_page: page50Data?.nextPage ?? null,
      },
      page_75: {
        ok: !page75Error,
        error: formatAuthError(page75Error),
        auth_user_count: page75Data?.users.length ?? 0,
        total: page75Data?.total ?? null,
        next_page: page75Data?.nextPage ?? null,
      },
    },
  })
}
