export const DAILY_SESSION_COOKIE = 'turnify_login_day'
export const DAILY_SESSION_MAX_AGE_SECONDS = 60 * 60 * 36
export const DAILY_SESSION_TIME_ZONE = 'Europe/Rome'

export function getDailySessionStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_SESSION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return `${year}-${month}-${day}`
}
