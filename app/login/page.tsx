'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

// Inner component that uses useSearchParams — must be wrapped in Suspense
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)

  const successMessage = searchParams.get('message') === 'password-aggiornata'
    ? 'Password aggiornata, accedi con la nuova password.'
    : ''

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setFailedAttempts(prev => prev + 1)
      setError('Email o password errati.')
      setLoading(false)
      return
    }

    // Reset failed attempts on successful login
    setFailedAttempts(0)

    // Legge il ruolo per decidere il redirect
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('users')
      .select('ruolo')
      .eq('id', user!.id)
      .single<{ ruolo: string }>()

    if (profile?.ruolo === 'admin') {
      router.push('/admin')
    } else {
      router.push('/user')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">

      {/* Logo / Titolo */}
      <div className="flex flex-col items-center mb-8 gap-3">
        <Image src="/logo.png" alt="Sigma" width={180} height={30} priority />
        <p className="text-sm text-gray-500">Gestione reperibilità</p>
      </div>

      {/* Success message from reset-password redirect */}
      {successMessage && (
        <p
          role="status"
          className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4"
        >
          {successMessage}
        </p>
      )}

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="nome@azienda.it"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}

        {/* Show "Password dimenticata?" link after 3 failed attempts */}
        {failedAttempts >= 3 && (
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Password dimenticata?
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {loading ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {/* Suspense required by Next.js when using useSearchParams in a client component */}
      <Suspense fallback={<div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm h-64 animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
