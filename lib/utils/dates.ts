// Utility condivise per date — usate da CalendarioDisponibilita e CalendarioGlobale

export const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

/**
 * Restituisce l'indice ISO del giorno della settimana (0=Lun … 6=Dom)
 */
export function isoWeekday(year: number, month: number, day: number): number {
  const dow = new Date(year, month, day).getDay() // 0=Dom…6=Sab
  return dow === 0 ? 6 : dow - 1                  // 0=Lun…6=Dom
}

/**
 * Formatta una data come stringa YYYY-MM-DD
 */
export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Restituisce true se il giorno è Sabato o Domenica
 */
export function isWeekendDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

/**
 * Formatta una data per la visualizzazione (es. "Sabato 3 Maggio 2026")
 */
export function formatFullDate(day: number, month: number, year: number): string {
  const dowNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  const dow = new Date(year, month, day).getDay()
  return `${dowNames[dow]} ${day} ${MONTH_NAMES[month]} ${year}`
}

/**
 * Restituisce il numero di giorni in un mese
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}
