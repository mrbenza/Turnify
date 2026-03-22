# TODO — Turnify

Funzionalita da implementare in ordine di priorita.

---

## Alta priorita

### Email notifica mese confermato (Resend)
- Integrare **Resend** (resend.com) per invio email automatico alla conferma mese
- La tabella `email_settings` e gia pronta su Supabase
- Le colonne `email_inviata` e `email_inviata_at` sono gia su `month_status`
- Logica: invio a tutti i dipendenti attivi + indirizzi extra in `email_settings`
- Variabile d'ambiente da aggiungere: `RESEND_API_KEY=re_...`
- Da installare: `npm install resend`
- Dopo invio: impostare `email_inviata = true` e `email_inviata_at = now()`

---

## Media priorita

### Multi-area con scheduling modes diversi
- **Obiettivo**: supportare piu aree aziendali, ognuna con la propria logica di turnazione e i propri dipendenti
- **Scheduling modes previsti**:
  | Mode | Comportamento |
  |------|--------------|
  | `weekend_full` | Sab+Dom sempre insieme (comportamento attuale) |
  | `single_day` | Sab e Dom indipendenti, assegnabili a persone diverse |
  | `sun_next_sat` | Chi lavora Dom lavora anche il Sab della settimana successiva |
- **Schema DB**: nuova tabella `areas` (id, name, scheduling_mode, template_path, manager_id); aggiungere `area_id` su `users`, `availability`, `shifts`, `month_status`
- **Frontend**: selettore area in navbar, `CalendarioGlobale` con logica dinamica per mode
- **Da chiarire prima dell'implementazione**: per `sun_next_sat`, cosa succede se il Sab successivo e gia occupato?

### Import storico — 2° reperibile (backup) e selezione per area
- Il foglio Excel ha gia la colonna E **"Nominativo 2° reperibile"** (backup), attualmente non usata dalla logica turni ordinaria
- Con il multi-area, il manager dovra poter **scegliere quale dei due reperibili** assegnare in base alla modalita di turnazione dell'area
- Modifiche necessarie (da pianificare insieme al multi-area):
  - `import-shifts/route.ts`: distinguere 1° e 2° reperibile invece di trattarli alla pari; restituire entrambi al frontend per la scelta
  - `ImportaStorico.tsx`: UI di selezione post-import ("per questo giorno: 1° Ferretti / 2° Bianchi — scegli")
  - Possibile colonna aggiuntiva su `shifts`: `reperibile_order` (1 o 2) per tracciare il ruolo storico

---

## Bassa priorita

### Festivita anni futuri
- Attualmente le festivita sono presenti solo fino al 2026
- Import automatico via Nager.Date per anni successivi (Vercel Cron Job il 1 gennaio)
- Bottone manuale "Aggiorna festivita {anno}" nella pagina Sistema

### Rotazione festivi comandati (es. Natale ogni 10 anni)
- **Obiettivo**: chi lavora un festivo comandato non dovrebbe riprenderlo per ~10 anni (con 10 persone in rotazione)
- **Situazione attuale**: lo score (festivo×3 pt totali) distribuisce i festivi attivi su base annuale, ma non garantisce una rotazione decennale
- **Opzione A**: moltiplicatori altissimi per i festivi piu pesanti (es. Natale = 480 pt = 4 wknd/mese × 12 mesi × 10 anni)
- **Opzione B**: blacklist per festivo specifico — chi ha lavorato Natale quest'anno non viene suggerito per Natale per N anni (tracciamento cross-anno separato)

---

## Completato

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
