'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ImpostazioniPassword() {
  const [nuovaPassword, setNuovaPassword] = useState('')
  const [confermaPassword, setConfermaPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

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
      setError('Errore durante l\'aggiornamento della password. Riprova.')
      return
    }

    setSuccess(true)
    setNuovaPassword('')
    setConfermaPassword('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
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

      {success && (
        <p
          role="status"
          className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2"
        >
          Password aggiornata con successo.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {loading ? 'Salvataggio...' : 'Aggiorna password'}
      </button>
    </form>
  )
}
