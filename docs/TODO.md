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
