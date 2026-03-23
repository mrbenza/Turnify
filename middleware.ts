import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  // Route /admin/* e /user/* richiedono autenticazione
  if ((pathname.startsWith('/admin') || pathname.startsWith('/user')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Route /login redirect a /user se già autenticato
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/user', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/user/:path*', '/login'],
}
