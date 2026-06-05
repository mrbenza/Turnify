import { describe, expect, it } from 'vitest'
import { isInternalPushTarget, isValidPushEndpoint, parsePushExpirationTime } from '@/lib/push/validation'

describe('Web Push validation', () => {
  it('accepts only internal notification targets', () => {
    expect(isInternalPushTarget('/user')).toBe(true)
    expect(isInternalPushTarget('/admin/export?mese=6')).toBe(true)
    expect(isInternalPushTarget('//example.com')).toBe(false)
    expect(isInternalPushTarget('/\\example.com')).toBe(false)
    expect(isInternalPushTarget('https://example.com')).toBe(false)
    expect(isInternalPushTarget(123)).toBe(false)
  })

  it('accepts only HTTPS push endpoints without credentials', () => {
    expect(isValidPushEndpoint('https://fcm.googleapis.com/push/example')).toBe(true)
    expect(isValidPushEndpoint('http://fcm.googleapis.com/push/example')).toBe(false)
    expect(isValidPushEndpoint('https://user:password@example.com/push')).toBe(false)
    expect(isValidPushEndpoint('not-a-url')).toBe(false)
    expect(isValidPushEndpoint(123)).toBe(false)
  })

  it('parses optional subscription expiration times', () => {
    expect(parsePushExpirationTime(null)).toBeNull()
    expect(parsePushExpirationTime(undefined)).toBeNull()
    expect(parsePushExpirationTime(Date.UTC(2026, 0, 1))).toBe('2026-01-01T00:00:00.000Z')
    expect(parsePushExpirationTime(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(parsePushExpirationTime('2026-01-01')).toBeUndefined()
  })
})
