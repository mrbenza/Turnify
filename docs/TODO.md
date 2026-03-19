# TODO — Turnify

Funzionalità da implementare in ordine di priorità.

---

## Alta priorità

### Email notifica mese confermato
- Integrare **Resend** (resend.com) per invio email automatico alla conferma mese
- La tabella `email_settings` è già pronta su Supabase
- Le colonne `email_inviata` e `email_inviata_at` sono già su `month_status`
- Logica: invio a tutti i dipendenti + indirizzi extra in `email_settings`
- Dopo invio: rollback mese non più possibile
- Da installare: `npm install resend`
- Variabile d'ambiente da aggiungere: `RESEND_API_KEY=re_...`

### Invio Excel via email → approved automatico
- Quando l'admin invia il file Excel via email (con Resend), segnare tutte le disponibilità `pending` del mese come `approved`
- Stessa logica già implementata per il download manuale (`GET /api/export`)
- Da coordinare con l'implementazione email Resend (vedi sopra)

---

## Bassa priorità

### Multi-area con scheduling modes diversi
- **Obiettivo**: supportare più aree aziendali, ognuna con la propria logica di turnazione e i propri dipendenti
- **Scheduling modes previsti**:
  | Mode | Comportamento |
  |------|--------------|
  | `weekend_full` | Sab+Dom sempre insieme (comportamento attuale) |
  | `single_day` | Sab e Dom indipendenti, assegnabili a persone diverse |
  | `sun_next_sat` | Chi lavora Dom lavora anche il Sab della settimana successiva |
- **Schema DB**: nuova tabella `areas` (id, name, scheduling_mode); aggiungere `area_id` su `users`, `availability`, `shifts`, `month_status`
- **Frontend**: selettore area in navbar, CalendarioGlobale con logica dinamica per mode
- **Da chiarire prima dell'implementazione**: per `sun_next_sat`, cosa succede se il Sab successivo è già occupato?
- **Permessi**: ogni admin vede e gestisce solo i dipendenti della propria area; un super-admin vede tutto

### Export Excel multi-area
- Ogni area ha il proprio template Excel con:
  - **Cella area**: nome dell'area di competenza (es. "AREA 4")
  - **Cella team leader**: nome del manager/admin responsabile dell'area (preso da `users` dove `ruolo = 'admin'` e `area_id` corrisponde)
- L'export filtra i turni per `area_id` dell'admin loggato
- Ogni area potrà avere il proprio template su Supabase Storage (es. `templates/AREA4.xlsx`, `templates/AREA7.xlsx`)

### Aggiornamento automatico festività
- **Fonte**: API pubblica gratuita senza auth — Nager.Date (`date.nager.at/api/v3/PublicHolidays/{anno}/IT`) o OpenHolidays API
- **Implementazione**: Vercel Cron Job (1 gennaio ogni anno) + bottone manuale "Aggiorna festività" nella pagina Impostazioni admin
- **Logica**: chiamata API → upsert nella tabella `holidays` per l'anno richiesto (evitare duplicati)
- **Attuale**: festività presenti solo fino al 2026, anni successivi non coperti

### Rotazione festivi comandati (es. Pasqua ogni 10 anni)
- **Obiettivo**: chi lavora un festivo comandato non dovrebbe riprenderlo per ~10 anni (con 10 persone in rotazione)
- **Situazione attuale**: lo score ponderato (festivo ×2, fest_cmd ×3) è solo cosmetic nella dashboard; il suggerito usa `turni_totali` grezzo (+1 per qualsiasi turno), quindi i festivi comandati non danno vantaggi reali nella rotazione
- **Opzione A**: ricalibrate i moltiplicatori score e usarli nel suggerito (es. fest_cmd = 480 punti = 4 wknd/mese × 12 mesi × 10 anni)
- **Opzione B**: blacklist per festivo specifico — chi ha lavorato Pasqua quest'anno non viene suggerito per Pasqua per N anni (tracciamento cross-anno separato)

---

## Completato

- ✅ **Export Excel su template aziendale** — JSZip modifica solo `sheet1.xml`, il resto del template (logo, firma, conditional formatting) rimane intatto. Cognome only, rosso weekend su D/E via inline rich text.
- ✅ **Score equità** — suggeriti ordinati per `turni_totali` grezzo (non score ponderato), con delta sessione via `sessionShiftIdsRef`
- ✅ **Sab+Dom stesso reperibile** — domenica suggerisce automaticamente chi ha lavorato il sabato
- ✅ **Fix API festivo su domenica** — il pair Sab+Dom viene escluso correttamente anche quando il festivo cade di domenica (es. Pasqua)
