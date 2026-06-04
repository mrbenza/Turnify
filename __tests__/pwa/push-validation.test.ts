import { describe, expect, it } from 'vitest'
import { isInternalPushTarget, isValidPushEndpoint } from '@/lib/push/validation'

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
})
