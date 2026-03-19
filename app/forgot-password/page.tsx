'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    // Always call resetPasswordForEmail regardless of whether email exists,
    // and always show the same generic response to avoid user enumeration.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })

    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">

        {/* Logo / Titolo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Turnify</h1>
          <p className="text-sm text-gray-500 mt-1">Recupero password</p>
        </div>

        {submitted ? (
          /* Generic success message — never reveals if email exists */
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-700 bg-blue-50 rounded-lg px-4 py-3">
              Se l&apos;email è registrata, riceverai a breve un link per
              reimpostare la password.
            </p>
            <Link
              href="/login"
              className="block text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Torna al login
            </Link>
          </div>
        ) : (
          /* Request form */
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Invio in corso...' : 'Invia link di reset'}
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
        )}
      </div>
    </div>
  )
}
