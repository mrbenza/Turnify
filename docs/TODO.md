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
- **Stato**: base implementata (fase 1 completata) — espansione a piu aree ancora da fare
- **Gia implementato (2026-03-23)**:
  - Tabella `areas` con `scheduling_mode` e `workers_per_day` (migration 011)
  - API `GET/PATCH /api/config` per leggere e aggiornare la configurazione
  - UI `GestioneArea` nella pagina Impostazioni (admin/manager)
  - `CalendarioGlobale` legge `scheduling_mode` e `workers_per_day` e applica la logica corretta
  - Auto-pairing turni: `weekend_full` (Sab↔Dom), `sun_next_sat` (Dom→Sab+7, Sab non ha pairing), `single_day` (nessun pairing)
  - Check `workers_per_day` nel backend `/api/shifts` — rifiuta se il giorno e gia pieno
  - Festivo su Sab/Dom si accoppia sempre con il partner della stessa settimana (tutti i mode)
- **Da implementare per il vero multi-area**:
  - Aggiungere `area_id` su `users`, `availability`, `shifts`, `month_status`
  - Selettore area in navbar (admin vede tutte, manager vede solo la sua)
  - `CalendarioGlobale` e `month_status` filtrati per area
  - Ogni manager gestisce solo i dipendenti della propria area

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

- **[v1.3.0] Configurazione area (scheduling_mode + workers_per_day)** — Tabella `areas` (migration 011), API `/api/config`, UI `GestioneArea` in Impostazioni. `CalendarioGlobale` applica auto-pairing dinamico per mode (`weekend_full`, `sun_next_sat`, `single_day`) e blocca assegnazioni quando `workers_per_day = 1` e il giorno e gia pieno.
- **[v1.3.0] Fix mesi confirmed non modificabili** — Le API `/api/shifts` (POST) e `/api/shifts/[id]` (DELETE) ora bloccano correttamente i mesi con `status = 'confirmed'` oltre a `locked`.
- **[v1.3.0] Fix doppio fetch in export e send-email** — `generateTurniExcel` ora restituisce `shiftsByDate` nel risultato; `export/route.ts` e `send-email/route.ts` la usano direttamente invece di rieseguire la query shifts/users.
- **[v1.3.0] Script DB** — `supabase/reset.sql` (cancella tutti i dati), `supabase/schema.sql` (schema completo migrations 001-011), `supabase/seed_demo.sql` (16 utenti, festività 2024-2026, turni 2024-2025, mesi confirmed, disponibilità gen-mar 2026).
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
