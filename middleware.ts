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

  // Route protette: richiedono autenticazione
  if ((pathname.startsWith('/admin') || pathname.startsWith('/user')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Controlla ruolo per le route protette e per /login
  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/user') || pathname === '/login')) {
    const { data: profile } = await supabase
      .from('users')
      .select('ruolo')
      .eq('id', user.id)
      .single()

    const ruolo = profile?.ruolo
    const isAdminOrManager = ruolo === 'admin' || ruolo === 'manager'

    // /login → redirect alla dashboard corretta
    if (pathname === '/login') {
      return NextResponse.redirect(new URL(isAdminOrManager ? '/admin' : '/user', request.url))
    }

    // /admin/* → solo admin e manager
    if (pathname.startsWith('/admin') && !isAdminOrManager) {
      return NextResponse.redirect(new URL('/user', request.url))
    }

    // /user/* → solo dipendenti (admin e manager hanno /admin)
    if (pathname.startsWith('/user') && isAdminOrManager) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/user/:path*', '/login'],
}
