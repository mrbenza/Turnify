# TODO — Turnify

Funzionalita da implementare in ordine di priorita.

---

## Alta priorita

*(Nessun item — tutto completato)*

---

## Media priorita

### Multi-area con scheduling modes diversi
- **Obiettivo**: supportare piu aree aziendali, ognuna con la propria logica di turnazione e i propri dipendenti
- **Stato attuale**: tabella `areas` creata (migration 011), API `/api/config` per leggere/aggiornare `scheduling_mode` e `workers_per_day`; riga "Default" inserita automaticamente
- **Scheduling modes previsti**:
  | Mode | Comportamento |
  |------|--------------|
  | `weekend_full` | Sab+Dom con conferma: assegni uno, il sistema propone l'altro |
  | `single_day` | Sab e Dom indipendenti, assegnabili a persone diverse |
  | `sun_next_sat` | Chi lavora Dom lavora anche il Sab della settimana successiva |
- **Ancora da fare**:
  1. Aggiungere `area_id` su `users`, `availability`, `shifts`, `month_status`
  2. Seed: assegnare tutti gli utenti esistenti all'area "Default"
  3. API: filtro `area_id` su shifts, availability, export, month_status
  4. UI admin: pagina Sistema con gestione aree (crea area, assegna manager, assegna dipendenti, carica template)
  5. NavbarAdmin manager: selettore area se manager ha piu aree
  6. CalendarioGlobale: logica dinamica per `scheduling_mode`
  7. Export: usa `areas.template_path` invece di template globale
  8. Statistiche: per area
- **Comportamento `sun_next_sat` chiarito**: se il Sab successivo e gia occupato il manager riceve un avviso (non un blocco) e decide autonomamente. I dipendenti sanno che Dom → Sab+7 è la regola; il Sab solitario è accettabile solo alla prima assegnazione o se il Sab è un festivo comandato.

### ✅ Import storico — 2° reperibile — NESSUNA MODIFICA NECESSARIA
- Colonna D = 1° reperibile (sempre presente), colonna E = 2° reperibile (presente solo se il manager ha assegnato 2 persone)
- Se E è presente, entrambi hanno effettivamente lavorato → entrambi contribuiscono allo score equità
- Il codice attuale importa già correttamente sia D che E come turni regolari (loop su `D${row}` + `E${row}`)
- Il file Excel è sempre lo specchio fedele della logica dei turni: non può esistere un E senza che quella persona abbia lavorato

---

## Bassa priorita

### ✅ Rotazione festivi comandati — COMPLETATO (2026-03-24)
Nel drawer di assegnazione, sotto il nome di ogni utente appare la nota "lavorato Pasqua '25" (o più anni) se ha già lavorato quel festivo in anni precedenti. Il manager decide autonomamente. Score non modificato.

---

## Completato

- **[2026-03-24] Storico festivi nel drawer** — Per ogni festivo obbligatorio, sotto ogni nome utente appare "lavorato [nome] '[anno]" se ha lavorato quel festivo in anni precedenti. Query client-side su `holidays` (mandatory, year < corrente) + `shifts` su quelle date. Score non modificato.
- **[2026-03-24] Pairing con conferma (tutti i modi)** — `weekend_full`: click Sab chiede conferma per Dom e viceversa. `sun_next_sat`: click Dom chiede conferma per Sab+7. In entrambi i casi il manager può scegliere "Solo Sab" / "Solo Dom". L'auto-pairing silenzioso è stato rimosso completamente. Dialog dinamico: testo e bottoni si adattano al giorno abbinato.
- **[2026-03-24] Festività anni futuri** — Import manuale via bottone "Aggiorna festivita {anno}" in pagina Sistema. Usa API Nager.Date (`/api/v3/PublicHolidays/{year}/IT`) per qualsiasi anno tra 2024 e 2030. Upsert sicuro: se l'anno e gia presente, non duplica ma restituisce i record esistenti.
- **[2026-03-23] Email notifica mese confermato** — Implementato con **Brevo** (brevo.com, free tier 300/giorno). `lib/email/sendTurniEmail.ts`: HTML + text + allegato Excel base64, BCC per tutti i destinatari. Auto-invio su export GET se `!email_inviata`; invio manuale via POST `/api/send-email`. Env vars: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.
- **[2026-03-23] Mesi confirmed immutabili** — Manager non puo sbloccare mesi `confirmed`; solo admin puo con dialog di conferma. CalendarioGlobale: `isConfirmed` prop separata da `locked`.
- **[2026-03-23] Admin aggiunto alla navbar Disponibilita** — Admin accede al CalendarioGlobale e puo sbloccare mesi confirmed.
- **[v1.2.0] Fix logout admin mobile** — Il pulsante "Altro" nella bottom bar mobile di `NavbarAdmin` e ora sempre visibile, garantendo accesso al logout anche per il ruolo admin che non ha voci nel menu overflow.
- **[v1.2.0] Loading skeleton su tutte le pagine SSR** — Aggiunto `loading.tsx` per tutte le route admin e user. Componente condiviso `AdminPageSkeleton` con `rows` e `grid` props. Elimina la pagina bianca durante il caricamento SSR.
- **[v1.2.0] StoricoTurni — conversione a server component** — `StoricoTurni.tsx` ora riceve `turni: ShiftRow[]` come prop da `app/user/page.tsx`; la query storico (ultimi 12 mesi) e aggiunta nel `Promise.all` della pagina; join con `month_status` in memoria tramite `statusMap`. Eliminato doppio round-trip client→server.
- **[v1.1.0] Refactor type safety** — Convertiti tutti i tipi in `lib/supabase/types.ts` da `interface` a `type`; rimossi 38 `eslint-disable any` e tutti i cast `as any`; rimossi ~40 cast ridondanti su risultati query Supabase; corretti 4 bug reali emersi (status literals, `.upsert()` → `.update()`, null→undefined in GestioneTemplate); versione mostrata nella sidebar admin.
- Export Excel su template aziendale — JSZip modifica solo `xl/worksheets/sheet1.xml`, il resto del template (logo, firma, conditional formatting) rimane intatto. Cognome only, rosso weekend su D/E via inline rich text.
- Score equita — suggeriti ordinati per `turni_totali` grezzo (non score ponderato), con delta sessione via `sessionCounts`
- Sab+Dom stesso reperibile — domenica suggerisce automaticamente chi ha lavorato il sabato della stessa settimana
- Fix API festivo su domenica — il pair Sab+Dom viene escluso correttamente anche quando il festivo cade di domenica (es. Pasqua)
- Ruolo manager con RLS — funzione `is_admin_or_manager()`, accesso a calendario, turni, statistiche, export, utenti dipendenti
- Template multipli per nome, export con selezione dinamica
- Dashboard admin riprogettata — contatori utenti, stato template, accesso rapido
- Dashboard manager — card mese corrente/prossimo con stato colorato, turni collapsibili
- Calendario festivita — import Nager.Date, toggle Attiva/Non attiva, aggiunta manuale, elimina, anni collassabili
- Importa storico reperibilita — multi-file, upload sequenziale, match per cognome, upsert + lock automatico
- Semantica `mandatory` semplificata — attiva = visibile + 3 pt + assegnabile; non attiva = ignorata completamente
- Score equita semplificato (migration 010) — 2 livelli: normale = 1 pt, festivo attivo = 3 pt; rimosso il livello fest_comandate
- Layout Sistema a 2 colonne
- Gestione utenti per ruolo — admin vede manager + dipendenti, manager vede solo dipendenti (ruolo non modificabile)
- Rename "Export" → "Invio turni" in navbar manager
- Lista turni: weekend Sab+Dom raggruppati in riga unica
- `month_status.status = 'confirmed'` impostato automaticamente dopo il download Excel
