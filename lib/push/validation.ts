const VALIDATION_ORIGIN = 'https://turnify.invalid'

export function isInternalPushTarget(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('\\')) return false

  try {
    return new URL(value, VALIDATION_ORIGIN).origin === VALIDATION_ORIGIN
  } catch {
    return false
  }
}

export function isValidPushEndpoint(value: unknown) {
  if (typeof value !== 'string') return false

  try {
    const endpoint = new URL(value)
    return endpoint.protocol === 'https:'
      && endpoint.username === ''
      && endpoint.password === ''
  } catch {
    return false
  }
}

export function parsePushExpirationTime(value: unknown) {
  if (value === null || typeof value === 'undefined') return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  return date.toISOString()
}
