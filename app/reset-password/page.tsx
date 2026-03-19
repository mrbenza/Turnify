'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [nuovaPassword, setNuovaPassword] = useState('')
  const [confermaPassword, setConfermaPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validation
    if (nuovaPassword.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.')
      return
    }
    if (nuovaPassword !== confermaPassword) {
      setError('Le due password non coincidono.')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password: nuovaPassword,
    })

    setLoading(false)

    if (updateError) {
      setError('Errore durante l\'aggiornamento della password. Il link potrebbe essere scaduto.')
      return
    }

    // Redirect to login with success message via query param
    router.push('/login?message=password-aggiornata')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">

        {/* Logo / Titolo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Turnify</h1>
          <p className="text-sm text-gray-500 mt-1">Imposta nuova password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="nuova-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nuova password
            </label>
            <input
              id="nuova-password"
              type="password"
              value={nuovaPassword}
              onChange={e => setNuovaPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="conferma-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Conferma password
            </label>
            <input
              id="conferma-password"
              type="password"
              value={confermaPassword}
              onChange={e => setConfermaPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {loading ? 'Salvataggio...' : 'Imposta nuova password'}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Torna al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
