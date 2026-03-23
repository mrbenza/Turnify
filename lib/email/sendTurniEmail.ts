const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

const DAY_NAMES_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

type Recipient = { email: string; name?: string }

type SendTurniEmailParams = {
  month: number  // 1-based
  year: number
  shiftsByDate: Map<string, string[]>
  recipients: Recipient[]
}

function buildHtml(month: number, year: number, shiftsByDate: Map<string, string[]>): string {
  const monthName = MONTH_NAMES_IT[month - 1]
  const daysInMonth = new Date(year, month, 0).getDate()

  const rows: string[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const names = shiftsByDate.get(dateStr) ?? []
    if (names.length === 0) continue

    const dow = new Date(year, month - 1, day).getDay()
    const isWeekend = dow === 0 || dow === 6
    const bg = isWeekend ? '#fff3cd' : '#ffffff'
    const dayLabel = `${DAY_NAMES_IT[dow]} ${day}`

    rows.push(`
      <tr style="background:${bg}">
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap">${dayLabel}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#111827">${names[0] ?? ''}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#111827">${names[1] ?? ''}</td>
      </tr>`)
  }

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#1d4ed8;padding:24px 32px">
            <p style="margin:0;color:#bfdbfe;font-size:13px;text-transform:uppercase;letter-spacing:.05em">Turnify</p>
            <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700">
              Turni di reperibilità — ${monthName} ${year}
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 32px">
            <p style="margin:0 0 20px;color:#4b5563;font-size:14px">
              Di seguito i turni di reperibilità assegnati per il mese di <strong>${monthName} ${year}</strong>.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:left;color:#6b7280;font-weight:600;white-space:nowrap">Giorno</th>
                  <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:left;color:#6b7280;font-weight:600">1° Reperibile</th>
                  <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;text-align:left;color:#6b7280;font-weight:600">2° Reperibile</th>
                </tr>
              </thead>
              <tbody>
                ${rows.join('')}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
            <p style="margin:0;color:#9ca3af;font-size:12px">
              Messaggio generato automaticamente da Turnify. Non rispondere a questa email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendTurniEmail(params: SendTurniEmailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY non configurata')

  const senderEmail = process.env.BREVO_SENDER_EMAIL
  if (!senderEmail) throw new Error('BREVO_SENDER_EMAIL non configurata')

  const { month, year, shiftsByDate, recipients } = params
  if (recipients.length === 0) return

  const monthName = MONTH_NAMES_IT[month - 1]
  const subject = `Turnify — Turni di reperibilità: ${monthName} ${year}`
  const htmlContent = buildHtml(month, year, shiftsByDate)

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME ?? 'Turnify',
        email: senderEmail,
      },
      to: recipients,
      subject,
      htmlContent,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo API error ${res.status}: ${body}`)
  }
}
