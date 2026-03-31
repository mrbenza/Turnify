import { vi } from 'vitest'

export interface QueryResult {
  data: unknown
  error: unknown
}

export const ok = (data: unknown): QueryResult => ({ data, error: null })
export const err = (msg: string): QueryResult => ({ data: null, error: { message: msg } })

/**
 * Crea una chain Supabase mock.
 * - Tutti i metodi builder (select, eq, gte, …) restituiscono la chain stessa.
 * - .single() e .maybeSingle() resolvono il risultato specificato.
 * - La chain è thenable, usabile con await diretto (es. array query).
 */
export function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}

  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gte', 'lte', 'gt', 'lt',
    'in', 'limit', 'order', 'range',
  ]) {
    chain[m] = () => chain
  }

  chain.single = vi.fn().mockResolvedValue(result)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)

  // Thenable: quando la chain è awaited direttamente (query ad array)
  chain.then = (
    resolve: (v: QueryResult) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) =>
    Promise.resolve(result).catch(reject)
  chain.finally = (cb: () => void) =>
    Promise.resolve(result).finally(cb)

  return chain
}

/**
 * Crea un mock del Supabase client.
 * Per ogni tabella si fornisce una coda di risultati (uno per chiamata in ordine).
 */
export function makeSupabaseMock({
  user,
  tables,
}: {
  user: { id: string } | null
  tables: Record<string, QueryResult[]>
}) {
  const counters: Record<string, number> = {}

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      const i = counters[table] ?? 0
      counters[table] = i + 1
      const result = tables[table]?.[i] ?? { data: null, error: null }
      return makeChain(result)
    }),
  }
}
