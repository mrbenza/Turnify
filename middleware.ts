import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { DAILY_SESSION_COOKIE, getDailySessionStamp } from '@/lib/auth/dailySession'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const dailySessionStamp = request.cookies.get(DAILY_SESSION_COOKIE)?.value ?? null
  const hasFreshDailySession = Boolean(user && dailySessionStamp === getDailySessionStamp())

  // Route /admin/* e /user/* richiedono autenticazione
  if ((pathname.startsWith('/admin') || pathname.startsWith('/user')) && !hasFreshDailySession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Route /login redirect alla home coerente col ruolo se già autenticato
  if (pathname === '/login' && hasFreshDailySession && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('ruolo')
      .eq('id', user.id)
      .single<{ ruolo: string }>()

    const targetPath = profile?.ruolo === 'admin' || profile?.ruolo === 'manager'
      ? '/admin'
      : '/user'

    return NextResponse.redirect(new URL(targetPath, request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/user/:path*', '/login'],
}
