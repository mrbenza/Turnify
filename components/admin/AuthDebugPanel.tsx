'use client'

import { useMemo, useState } from 'react'

type DebugAction = 'summary' | 'listUsers' | 'getUserById' | 'batchGetUserById' | 'batchGetUserByIdSequential' | 'batchGetUserByIdLimited' | 'rpcLastSignIns'
type ErrorSummary = { status: string | null; name: string | null; message: string | null }

function buildUrl(
  action: DebugAction,
  perPage: string,
  page: string,
  userId: string,
  limit: string,
  offset: string,
  concurrency: string
) {
  const params = new URLSearchParams()
  params.set('action', action)

  if (action === 'listUsers') {
    params.set('perPage', perPage || '25')
    params.set('page', page || '1')
  }

  if (action === 'getUserById' && userId.trim()) {
    params.set('userId', userId.trim())
  }

  if (action === 'batchGetUserById' || action === 'batchGetUserByIdSequential' || action === 'batchGetUserByIdLimited' || action === 'rpcLastSignIns') {
    params.set('limit', limit || '25')
    params.set('offset', offset || '0')
  }

  if (action === 'batchGetUserByIdLimited') {
    params.set('concurrency', concurrency || '3')
  }

  return `/api/debug/auth?${params.toString()}`
}

export default function AuthDebugPanel() {
  const [action, setAction] = useState<DebugAction>('summary')
  const [perPage, setPerPage] = useState('25')
  const [page, setPage] = useState('1')
  const [userId, setUserId] = useState('')
  const [limit, setLimit] = useState('25')
  const [offset, setOffset] = useState('0')
  const [concurrency, setConcurrency] = useState('3')
  const [responseText, setResponseText] = useState('')
  const [errorText, setErrorText] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  const requestUrl = useMemo(
    () => buildUrl(action, perPage, page, userId, limit, offset, concurrency),
    [action, perPage, page, userId, limit, offset, concurrency]
  )

  async function handleRun() {
    setLoading(true)
    setErrorText('')
    setErrorSummary(null)
    setCopyState('idle')

    try {
      const response = await fetch(requestUrl, { cache: 'no-store' })
      const text = await response.text()
      setStatusCode(response.status)
      try {
        const parsed = JSON.parse(text)
        setResponseText(JSON.stringify(parsed, null, 2))
        const maybeError = parsed?.result?.error ?? parsed?.get_user_by_id?.error ?? null
        setErrorSummary(maybeError ? {
          status: maybeError.status != null ? String(maybeError.status) : null,
          name: maybeError.name ?? null,
          message: maybeError.message ?? null,
        } : null)
      } catch {
        setResponseText(text)
        setErrorSummary(null)
      }
      if (!response.ok) {
        setErrorText(`HTTP ${response.status}`)
      }
    } catch (error) {
      setResponseText('')
      setStatusCode(null)
      setErrorSummary(null)
      setErrorText(error instanceof Error ? error.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }


  async function handleCopy() {
    if (!responseText) return
    try {
      await navigator.clipboard.writeText(responseText)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  function reset() {
    setAction('summary')
    setPerPage('25')
    setPage('1')
    setUserId('')
    setLimit('25')
    setOffset('0')
    setConcurrency('3')
    setResponseText('')
    setErrorText('')
    setStatusCode(null)
    setErrorSummary(null)
    setCopyState('idle')
  }

  const isBatchAction = action === 'batchGetUserById' || action === 'batchGetUserByIdSequential' || action === 'batchGetUserByIdLimited' || action === 'rpcLastSignIns'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-7">
        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs font-medium text-gray-600">Azione</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as DebugAction)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="summary">summary</option>
            <option value="listUsers">listUsers</option>
            <option value="getUserById">getUserById</option>
            <option value="batchGetUserById">batchGetUserById</option>
            <option value="batchGetUserByIdSequential">batchGetUserByIdSequential</option>
            <option value="batchGetUserByIdLimited">batchGetUserByIdLimited</option>
            <option value="rpcLastSignIns">rpcLastSignIns</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600">Per page</span>
          <input
            type="number"
            min={1}
            value={perPage}
            onChange={(e) => setPerPage(e.target.value)}
            disabled={action !== 'listUsers'}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600">Page</span>
          <input
            type="number"
            min={1}
            value={page}
            onChange={(e) => setPage(e.target.value)}
            disabled={action !== 'listUsers'}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600">Limit</span>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            disabled={!isBatchAction}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600">Offset</span>
          <input
            type="number"
            min={0}
            value={offset}
            onChange={(e) => setOffset(e.target.value)}
            disabled={!isBatchAction}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600">Concurrency</span>
          <input
            type="number"
            min={1}
            value={concurrency}
            onChange={(e) => setConcurrency(e.target.value)}
            disabled={action !== 'batchGetUserByIdLimited'}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600">User ID</span>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={action !== 'getUserById'}
            placeholder="vuoto = utente loggato"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
          />
        </label>
        <div className="rounded-xl border border-gray-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          <div className="font-medium">Modalita batch</div>
          <p className="mt-1 text-blue-800">
            Usa `public.users` come base e poi chiama `getUserById` su ogni riga caricata. Ora puoi confrontare parallelo, sequenziale e concorrenza limitata.
          </p>
          <p className="mt-2 text-blue-800">
            `rpcLastSignIns` usa invece una RPC Postgres che legge `auth.users.last_sign_in_at` senza passare da `auth.admin.*`.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Esecuzione...' : 'Esegui test'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reset
        </button>
        <a
          href={requestUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Apri URL raw
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          <div className="font-medium text-gray-800">Request URL</div>
          <div className="mt-1 break-all">{requestUrl}</div>
          {errorText && <div className="mt-2 text-red-600">{errorText}</div>}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs">
          <div className="font-medium text-gray-800">Stato risposta</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-1 font-medium ${statusCode && statusCode < 400 ? 'bg-green-50 text-green-700' : statusCode ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
              {statusCode ?? '?'}
            </span>
            <span className="text-gray-500">{action}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[10, 25, 50, 72, 73, 75, 100].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setAction('listUsers')
              setPerPage(String(value))
              setPage('1')
            }}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-white"
          >
            perPage {value}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 72, 73, 74].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setAction('listUsers')
              setPerPage(perPage || '25')
              setPage(String(value))
            }}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-white"
          >
            page {value}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[10, 25, 50].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setAction('batchGetUserById')
              setLimit(String(value))
              setOffset('0')
            }}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-white"
          >
            batch {value}
          </button>
        ))}
        {[10, 25].map((value) => (
          <button
            key={`seq-${value}`}
            type="button"
            onClick={() => {
              setAction('batchGetUserByIdSequential')
              setLimit(String(value))
              setOffset('0')
            }}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-white"
          >
            sequential {value}
          </button>
        ))}
        {[2, 3, 5].map((value) => (
          <button
            key={`limited-${value}`}
            type="button"
            onClick={() => {
              setAction('batchGetUserByIdLimited')
              setConcurrency(String(value))
              setLimit('25')
              setOffset('0')
            }}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-white"
          >
            limited {value}
          </button>
        ))}
        {[0, 25, 50, 74].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setOffset(String(value))
            }}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-white"
          >
            offset {value}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setAction('rpcLastSignIns')
            setLimit('25')
            setOffset('74')
          }}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-white"
        >
          rpc 25 @ 74
        </button>
      </div>

      {errorSummary && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-900">Errore rilevato</h2>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-red-800 md:grid-cols-3">
            <div>
              <div className="font-medium">Status</div>
              <div>{errorSummary.status ?? '?'}</div>
            </div>
            <div>
              <div className="font-medium">Nome</div>
              <div>{errorSummary.name ?? '?'}</div>
            </div>
            <div>
              <div className="font-medium">Messaggio</div>
              <div>{errorSummary.message ?? '?'}</div>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Risposta JSON</h2>
            <p className="mt-0.5 text-xs text-gray-500">Output formattato della route di debug.</p>
          </div>
          <div className="flex items-center gap-2">
            {copyState === 'copied' && <span className="text-xs text-green-700">Copiato</span>}
            {copyState === 'error' && <span className="text-xs text-red-600">Copia fallita</span>}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!responseText}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copia JSON
            </button>
          </div>
        </div>
        <pre className="max-h-[60vh] overflow-auto bg-gray-950 p-4 text-xs leading-6 text-gray-100">
          {responseText || 'Nessuna risposta ancora.'}
        </pre>
      </section>
    </div>
  )
}
