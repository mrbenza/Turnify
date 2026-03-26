# Turnify — Gestione Turni di Reperibilita
**v2.0.0**

Web app per la gestione dei turni di reperibilita dei dipendenti.
Permette ai dipendenti di segnare la propria disponibilita su un calendario,
al manager di assegnare i turni garantendo una rotazione equa e di esportare
il mese confermato in formato Excel, e all'admin di gestire utenti, template
e calendario festivita.

---

## Stack tecnico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| Frontend | Next.js 15 App Router + React 19 + Tailwind CSS | Hosting: Vercel |
| Database | Supabase PostgreSQL | Free tier |
| Auth | Supabase Auth | Email + password |
| Export Excel | API route Next.js + JSZip | Modifica solo `xl/worksheets/sheet1.xml` del template; logo, firma e conditional formatting rimangono intatti |
| Type Safety | TypeScript 5 + Supabase JS v2 | `lib/supabase/types.ts` generato da Supabase CLI; zero `any` cast nel codebase |
| Email | Brevo SMTP API | Free tier, 300 email/giorno, allegato Excel in base64 |

---

## Struttura cartelle

```
turnify/
├── README.md
├── CLAUDE.md
├── docs/
│   ├── AGENTS.md
│   ├── SHEET_SCHEMA.md
│   ├── LOGICA_TURNI.md
│   └── TODO.md
├── app/
│   ├── page.tsx                     ← redirect a /login
│   ├── layout.tsx
│   ├── globals.css
│   ├── login/page.tsx
│   ├── user/
│   │   ├── page.tsx                 ← dashboard dipendente (SSR: availability, holidays, shifts, month_status, storico in Promise.all)
│   │   ├── loading.tsx              ← skeleton calendario + storico turni
│   │   └── impostazioni/
│   │       ├── page.tsx
│   │       └── loading.tsx          ← skeleton inline (layout user, non admin)
│   ├── admin/
│   │   ├── page.tsx                 ← dashboard admin/manager
│   │   ├── loading.tsx              ← skeleton generico (3 card)
│   │   ├── disponibilita/
│   │   │   ├── page.tsx             ← calendario globale (manager)
│   │   │   └── loading.tsx          ← skeleton 2 card a griglia
│   │   ├── turni/
│   │   │   ├── page.tsx             ← lista turni (non in navbar manager)
│   │   │   └── loading.tsx          ← skeleton 4 card
│   │   ├── statistiche/
│   │   │   ├── page.tsx             ← score equita (manager only)
│   │   │   └── loading.tsx          ← skeleton 2 card
│   │   ├── export/
│   │   │   ├── page.tsx             ← "Invio turni" — genera Excel (manager)
│   │   │   └── loading.tsx          ← skeleton 2 card
│   │   ├── utenti/
│   │   │   ├── page.tsx             ← gestione utenti (admin + manager)
│   │   │   └── loading.tsx          ← skeleton 4 card
│   │   ├── sistema/
│   │   │   ├── page.tsx             ← template, festivita, import storico (admin only)
│   │   │   └── loading.tsx          ← skeleton 4 card a griglia
│   │   └── impostazioni/
│   │       ├── page.tsx             ← email notifiche (manager)
│   │       └── loading.tsx          ← skeleton 3 card
│   └── api/
│       ├── shifts/route.ts          ← GET lista turni, POST assegna
│       ├── shifts/[id]/route.ts     ← DELETE rimuovi turno
│       ├── availability/route.ts    ← GET/POST disponibilita
│       ├── month/route.ts           ← GET/POST stato mese (lock/unlock)
│       ├── export/route.ts          ← GET genera XLSX da template + imposta status 'confirmed' + auto-email
│       ├── send-email/route.ts      ← POST invia email manuale con allegato Excel
│       ├── import-shifts/route.ts   ← POST importa storico da XLSX (JSZip)
│       ├── import-shifts/resolve/route.ts ← POST risolve turni con utente non trovato
│       ├── holidays/route.ts        ← GET/POST/DELETE gestione festivita
│       ├── email-settings/route.ts  ← GET/POST indirizzi email extra
│       ├── email-settings/[id]/route.ts ← PATCH (toggle attivo) / DELETE
│       ├── config/route.ts          ← GET/PATCH scheduling_mode e workers_per_day (tabella areas)
│       ├── areas/route.ts           ← GET lista aree, POST crea area (admin)
│       ├── areas/[id]/route.ts      ← PATCH aggiorna area (cascade manager), DELETE
│       ├── areas/[id]/users/route.ts ← GET utenti area, PATCH sposta utente
│       ├── equity-overview/route.ts ← GET panoramica equita cross-area (admin)
│       ├── users/route.ts           ← POST crea nuovo utente
│       ├── users/[id]/route.ts      ← PATCH (attivo/ruolo), DELETE
│       └── users/[id]/shifts/route.ts ← GET storico turni dipendente
├── components/
│   ├── auth/AuthGuard.tsx           ← timeout sessione automatico
│   ├── AdminPageSkeleton.tsx        ← skeleton condiviso (sidebar + content) usato da tutti i loading.tsx admin; props: rows, grid
│   ├── user/
│   │   ├── NavbarUtente.tsx
│   │   ├── CalendarioDisponibilita.tsx
│   │   └── StoricoTurni.tsx         ← server component puro; riceve turni: ShiftRow[] come prop; vista mobile (card) + desktop (table)
│   └── admin/
│       ├── NavbarAdmin.tsx          ← sidebar desktop + bottom bar mobile; nav diversa per admin vs manager; "Altro" sempre visibile su mobile per accesso logout
│       ├── dashboard/
│       │   └── TurniCollapsibili.tsx ← sezione turni collassabile nella dashboard manager
│       ├── disponibilita/
│       │   ├── CalendarioGlobale.tsx
│       │   └── AreaSelector.tsx             ← select client-side per navigazione tra aree
│       ├── aree/
│       │   └── GestioneAree.tsx     ← crea/modifica/elimina aree, sposta utenti, assegna manager
│       ├── equita/
│       │   └── RiepilogoEquitaAree.tsx ← panoramica cross-area (solo admin), badge salute
│       ├── turni/
│       │   └── ListaTurni.tsx       ← weekend Sab+Dom raggruppati in una riga
│       ├── statistiche/
│       │   └── GraficoEquita.tsx
│       ├── export/
│       │   └── ExportForm.tsx       ← anteprima grafica + genera Excel
│       ├── utenti/
│       │   └── ListaUtenti.tsx      ← prop isManager: se true, ruolo non modificabile; ricerca per nome; filtro area
│       ├── impostazioni/
│       │   └── GestioneEmail.tsx
│       └── sistema/
│           ├── GestioneTemplate.tsx
│           ├── AggiornamentoCalendario.tsx  ← anni collassabili, toggle Attiva/Non attiva
│           └── ImportaStorico.tsx           ← upload multi-file sequenziale
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts             ← tipi generati da Supabase CLI; export type (non interface); zero any
│   ├── excel/
│   │   └── generateTurniExcel.ts ← genera XLSX dal template (JSZip), condiviso da export e send-email
│   ├── email/
│   │   └── sendTurniEmail.ts    ← invia email Brevo con allegato Excel, BCC destinatari
│   └── utils/
│       ├── dates.ts
│       └── sort.ts              ← sortByNome con Intl.Collator numeric (ordinamento naturale aree)
├── components/ui/
│   └── Select.tsx               ← custom select Portal-based (dropdown a document.body, immune a position:fixed e zoom Chrome)
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql
        ├── 002_fix_month_status_rls.sql
        ├── 003_fix_equity_scores.sql
        ├── 004_holidays_year_column.sql
        ├── 005_month_status_confirmed.sql
        ├── 006_manager_role_rls.sql
        ├── 007_equity_scores_lower_weights.sql
        ├── 008_equity_scores_fix_role.sql
        ├── 009_fix_users_role_constraint.sql
        ├── 010_simplify_equity_scores.sql
        └── 011_areas.sql
```

---

## Ruoli utente

| Ruolo | Accesso | Permessi principali |
|-------|---------|---------------------|
| `admin` | `/admin` | Gestisce utenti (manager + dipendenti), carica template Excel, gestisce calendario festivita, importa storico reperibilita. Non gestisce turni operativi. |
| `manager` | `/admin` | Assegna turni, visualizza disponibilita, verifica equita, esporta Excel mensile, gestisce email notifiche, aggiunge/disattiva dipendenti. |
| `dipendente` | `/user` | Inserisce disponibilita per il mese corrente e il prossimo, visualizza i propri turni assegnati. |

---

## Pagine per ruolo

### Admin

| Pagina | Descrizione |
|--------|-------------|
| `/admin` | Dashboard: contatori utenti (manager + dipendenti, esclusi admin), stato template Excel, accesso rapido a Utenti e Sistema. |
| `/admin/utenti` | Gestione utenti: vede tutti tranne altri admin (manager + dipendenti). Puo aggiungere, cambiare ruolo, attivare/disattivare, eliminare. |
| `/admin/sistema` | Layout a 2 colonne: upload template Excel, importazione storico reperibilita da XLSX, calendario festivita (import da Nager.Date, toggle Attiva/Non attiva, aggiunta manuale, elimina). |

Navbar admin (sidebar desktop): Dashboard — Utenti — Sistema

### Manager

| Pagina | Descrizione |
|--------|-------------|
| `/admin` | Dashboard: card mese corrente + prossimo con stato colorato, sezione turni collassata di default, contatore dipendenti. Stati card: "Da completare" (grigio), "In corso" (ambra), "Pronto per invio" (blu), "Confermato" (verde). |
| `/admin/disponibilita` | Calendario globale: righe = dipendenti, colonne = giorni, click su un giorno per assegnare turno con suggerimento per equita. |
| `/admin/statistiche` | Score equita per dipendente, filtro per mese o tutti i tempi. |
| `/admin/export` (UI: "Invio turni") | Anteprima turni con grafico distribuzione, genera Excel da template aziendale. Imposta il mese a `confirmed` dopo il download. |
| `/admin/utenti` | Solo dipendenti: puo aggiungere nuovi (ruolo fisso = dipendente), attivare/disattivare, eliminare. Non puo cambiare ruolo. |
| `/admin/impostazioni` | Indirizzi email extra per notifiche. |

Navbar manager (sidebar desktop + bottom bar mobile):
- Principale: Dashboard, Disponibilita, Statistiche
- Sezione "Altro": Invio turni (`/admin/export`), Impostazioni

### Dipendente

| Pagina | Descrizione |
|--------|-------------|
| `/user` | Calendario disponibilita (mese corrente + prossimo) e storico turni assegnati. |

---

## Flusso operativo

```
1. Dipendente → /user
   Segna disponibilita (mese corrente e prossimo).
   Puo modificare fino a quando il mese non e locked.

2. Manager → /admin/disponibilita
   Visualizza il calendario globale con la disponibilita di tutti i dipendenti.
   Clicca su un giorno (weekend o festivo attivo) per assegnare un turno.
   Il sistema suggerisce il dipendente con score piu basso (equita).

3. Manager → /admin/statistiche
   Verifica la distribuzione equa dei turni per mese o storico.

4. Manager → /admin/disponibilita → Conferma mese
   Validazione: tutti i weekend e i festivi attivi devono avere almeno 1 turno.
   month_status → 'locked' (mese immutabile, disponibilita bloccate).

5. Manager → /admin/export ("Invio turni")
   Seleziona il mese, carica l'anteprima grafica (distribuzione turni).
   Genera Excel dal template aziendale (JSZip, preserva logo/firma/formatting).
   Download → month_status → 'confirmed' + email automatica via Brevo (se non gia inviata).
   In alternativa: "Invia email" per invio manuale senza download.

6. Admin → /admin/sistema (separato dal flusso operativo)
   Carica il template Excel.
   Importa storico reperibilita da file XLSX precedenti.
   Gestisce il calendario festivita (import Nager.Date, attiva/disattiva).
```

---

## Schema DB — tabelle principali

### `users`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK, generato da Supabase Auth |
| nome | text | nome e cognome |
| email | text | unique |
| ruolo | text | `admin` \| `manager` \| `dipendente` |
| attivo | boolean | default true |
| area_id | uuid | FK → areas.id |
| disattivato_at | timestamptz | nullable; impostato quando `attivo` viene messo a false |
| data_creazione | timestamptz | default now() |

### `areas`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| nome | text | unique |
| scheduling_mode | text | `weekend_full` \| `single_day` \| `sun_next_sat` |
| workers_per_day | integer | 1 o 2 — numero di reperibili per giornata |
| manager_id | uuid | FK → users.id, nullable |
| template_path | text | nullable |

### `availability`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| date | date | giorno di disponibilita |
| available | boolean | |
| status | text | `pending` \| `approved` \| `locked` |
| area_id | uuid | FK → areas.id |

### `shifts`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| date | date | giorno del turno |
| user_id | uuid | FK → users.id |
| shift_type | text | `weekend` \| `festivo` \| `reperibilita` |
| reperibile_order | integer | 1 = primo reperibile (col D Excel), 2 = secondo (col E) |
| area_id | uuid | FK → areas.id |
| created_by | uuid | FK → users.id |

`shift_type = 'festivo'` viene usato solo se il giorno e una festivita con `mandatory = true`.

### `holidays`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| date | date | data della festivita |
| name | text | es. "Natale" |
| mandatory | boolean | `true` = attiva (visibile, assegnabile, vale 3 pt nello score); `false` = ignorata completamente |
| year | integer | anno (colonna computed) |

### `month_status`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| month | integer | 1–12 |
| year | integer | |
| status | text | `open` \| `locked` \| `confirmed` |
| area_id | uuid | FK → areas.id — unique(month, year, area_id) |
| locked_by | uuid | FK → users.id |
| locked_at | timestamptz | |
| email_inviata | boolean | default false |
| email_inviata_at | timestamptz | nullable |

Status:
- `open` — in lavorazione
- `locked` — confermato dal manager, pronto per export; **immutabile** (nessuna write su availability/shifts/import consentita)
- `confirmed` — Excel generato/scaricato (impostato automaticamente da `/api/export`); **immutabile** come `locked`

### `email_settings`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| email | text | unique |
| descrizione | text | nullable |
| attivo | boolean | default true |
| area_id | uuid | FK → areas.id — ownership per area; ogni manager gestisce solo le proprie |

---

## Algoritmo equita

Formula score (migration 010):
```
score = turni_totali + (festivi_attivi x 2)
```

- Ogni turno normale vale 1 pt
- Ogni turno su festivita attiva (`mandatory = true`) vale 3 pt (1 base + 2 extra)
- Score piu basso = priorita piu alta

Funzione RPC: `get_equity_scores(p_month integer, p_year integer)`
- `p_month = 0` → score su tutti i tempi
- `p_month > 0` → score filtrato per mese/anno specificato

Suggerimento assegnazione in `CalendarioGlobale`:
- Ordinato per `turni_totali` grezzo (non score ponderato) + delta sessione (`sessionCounts`)
- Cross-month Saturday: chi ha lavorato il sabato del mese precedente ha priorita sul primo sabato del mese nuovo
- Same-month Sab+Dom: la domenica suggerisce automaticamente chi ha lavorato il sabato della stessa settimana

---

## Sicurezza

- Row Level Security (RLS) abilitata su tutte le tabelle Supabase (migration 016: area-aware)
- `current_user_area_id()` e `is_manager()` — funzioni SQL per RLS che isolano i manager alla propria area
- Manager: solo `SELECT` su `public.users` via RLS — impedisce privilege escalation (auto-promozione ad admin via REST Supabase diretto)
- Tutte le write su `public.users` (PATCH ruolo/attivo, DELETE, POST) usano `serviceClient` (service_role) nelle API route
- Cross-area enforcement: manager non può leggere o scrivere dati di altre aree neanche bypassando le API con JWT valido
- Il frontend usa il client Supabase con chiave `anon`; le operazioni privilegiate usano la `service_role` key solo nelle API route server-side Next.js
- `AuthGuard.tsx` gestisce il timeout automatico della sessione lato frontend
- `userId` e ruolo non transitano mai dal browser — vengono letti dalla sessione server-side
- Nomi utente nel template HTML email sanitizzati via `escHtml()` — previene XSS injection tramite nomi malevoli
- **Immutabilità mesi**: `locked` e `confirmed` bloccano ogni write su `availability`, `shifts`, `import-shifts`, `import-shifts/resolve` (HTTP 422 con messaggio esplicito)
- **Validazione copertura al lock**: `POST /api/month` con `action=lock` verifica server-side che ogni sabato, domenica e festivo obbligatorio del mese abbia esattamente `workers_per_day` turni assegnati — impedisce il lock di mesi incompleti
- `service_role` key usata solo dove strettamente necessario (auth.admin.*, storage, write su tabelle senza policy write nel DB); ogni occorrenza è documentata con commento inline

---

## Variabili d'ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BREVO_API_KEY=
BREVO_SENDER_EMAIL=      # indirizzo verificato su Brevo
BREVO_SENDER_NAME=       # nome mittente (default: "Turnify")
```

---

## Setup iniziale

1. Creare un progetto Supabase
2. Eseguire le migration in ordine tramite SQL Editor:

| Migration | Contenuto |
|-----------|-----------|
| `001_initial_schema.sql` | Schema iniziale, RLS, festivita 2026 |
| `002_fix_month_status_rls.sql` | Fix RLS month_status (policy INSERT separata) |
| `003_fix_equity_scores.sql` | Fix get_equity_scores filtro mese, aggiunta email_settings, colonne month_status |
| `004_holidays_year_column.sql` | Colonna year su holidays (computed) |
| `005_month_status_confirmed.sql` | Status 'confirmed' su month_status |
| `006_manager_role_rls.sql` | Ruolo manager: RLS is_admin_or_manager() |
| `007_equity_scores_lower_weights.sql` | Score equita pesi ridotti |
| `008_equity_scores_fix_role.sql` | Fix ruolo 'user' → 'dipendente' nella funzione SQL |
| `009_fix_users_role_constraint.sql` | Fix constraint users.ruolo (admin\|manager\|dipendente) |
| `010_simplify_equity_scores.sql` | Semplifica score: solo festivi_attivi×2, rimuove fest_comandate |
| `011_areas.sql` | Tabella `areas` con scheduling_mode e workers_per_day; riga "Default" inserita automaticamente |
| `012_reperibile_order.sql` | Colonna `reperibile_order` su shifts (1 = col D, 2 = col E) |
| `013_multi_area.sql` | `area_id` su users/shifts/availability/month_status; unique (month, year, area_id) |
| `014_email_settings_area_id.sql` | `area_id NOT NULL` su email_settings; unique(email, area_id) |
| `015_areas_template_manager.sql` | `template_path` e `manager_id` su areas |
| `016_rls_area_aware.sql` | RLS area-aware su tutte le tabelle; manager solo SELECT su users (privilege escalation prevention) |

3. Configurare le variabili d'ambiente (`.env.local` in sviluppo, pannello Vercel in produzione)
4. Creare il primo admin: Authentication → Users → Add user, poi inserire riga in `users` con `ruolo = 'admin'`
5. `npm install && npm run dev`

---

## Deploy Vercel

1. Importare il repository su Vercel
2. Framework Preset: Next.js; Root Directory: vuoto
3. Aggiungere le variabili d'ambiente nel pannello Vercel
4. Ogni push su `main` triggera un deploy automatico

---

## TODO

Vedi `docs/TODO.md` per il backlog completo.

### Debito tecnico (non urgente)
- Centralizzare helper auth server-side (`requireUser`, `requireAdminOrManager`, `requireArea`)
- Introdurre test automatici per i casi business critici (lock, immutabilita, isolamento area)
- Strato unico di validazione input nelle route critiche

---

## Changelog

### [2026-03-26] — v2.0.0: Multi-area, security hardening, custom Select

**Funzionalita principali:**
- **Multi-area completo**: 14 aree indipendenti, ogni area con manager, dipendenti, scheduling_mode e workers_per_day propri. Import storico area-aware (matching a 3 livelli), export Excel area-aware (nome file, nome area in A1, team leader in C51). Panoramica equita cross-area per admin (`/admin/equita`). Navigazione mesi filtrata per area in CalendarioGlobale.
- **Immutabilita mesi**: `locked` e `confirmed` bloccano ogni write su availability, shifts, import-shifts e import-shifts/resolve. Ritorna HTTP 422 con messaggio leggibile.
- **Validazione copertura al lock**: server-side verifica che tutti i sabati, domeniche e festivi obbligatori del mese abbiano `workers_per_day` turni prima di permettere il lock. Ritorna HTTP 422 con lista giorni scoperti.
- **Custom Select Portal-based** (`components/ui/Select.tsx`): dropdown renderizzato a `document.body` tramite `createPortal`, immune a `position:fixed` e zoom Chrome. Adottato in ListaUtenti, GestioneAree, AggiornamentoCalendario, GraficoEquita.
- **Service-role ridotto**: rimosso da email-settings (POST/PATCH/DELETE) e da 5 pagine SSR con solo SELECT su areas. Ogni occorrenza rimanente documentata con commento `// service_role: <motivo>`.

### [2026-03-26] — Security audit #2: XSS fix email HTML + audit completo

**File modificati:**
- `lib/email/sendTurniEmail.ts`

**Sommario:** Secondo round di audit sicurezza (bypass login, escalation, esposizione API). Trovato e risolto XSS injection via nomi utente nel template HTML delle email.

**Dettagli:**
1. `sendTurniEmail.ts` — Aggiunta funzione `escHtml()` che sanitizza `&`, `<`, `>`, `"`, `'`. I nomi utente nei campi `names[0]` e `names[1]` sono ora escaped prima dell'inserimento nell'HTML dell'email, prevenendo injection di tag HTML/JS da parte di un admin che avesse creato un utente con nome malevolo.

**Status:** Completato

---

### [2026-03-26] — Security hardening: privilege escalation fix + storico dipendente

**File modificati:**
- `app/api/users/[id]/route.ts`
- `app/api/users/[id]/shifts/route.ts` (nuovo)
- `app/api/shifts/[id]/route.ts`
- `app/api/shifts/route.ts`
- `supabase/migrations/016_rls_area_aware.sql` (nuovo)
- `supabase/schema.sql` (aggiornato a 001–016)
- `supabase/clean_db.sql` (nuovo)
- `components/admin/statistiche/DrawerStoricoDipendente.tsx` (nuovo)
- `components/admin/statistiche/GraficoEquita.tsx`
- `app/layout.tsx` (rimosso Geist_Mono)

**Sommario:** Eliminati 4 vettori di privilege escalation/cross-area; RLS area-aware su Supabase; drawer storico dipendente nella pagina statistiche.

**Dettagli:**
1. `shifts/[id]/route.ts` DELETE — manager ora filtra per `area_id`; non può eliminare turni di altre aree.
2. `shifts/route.ts` POST — verifica che `user_id` dal body appartenga all'area del manager (403 se cross-area).
3. `users/[id]/shifts/route.ts` GET — nuovo endpoint storico turni per dipendente. Manager: 403 se il target è in un'altra area.
4. `016_rls_area_aware.sql` — `current_user_area_id()` + `is_manager()`; policy RLS separate per admin/manager/dipendente su shifts, availability, month_status, users, email_settings. Manager: solo `FOR SELECT` su `users` (previene auto-promozione ad admin via REST diretto).
5. `users/[id]/route.ts` PATCH/DELETE — tutte le write su `public.users` spostate su `serviceClient`; aggiunto check cross-area per il toggle `attivo` (manager non può agire su utenti di altre aree).
6. `DrawerStoricoDipendente.tsx` — drawer laterale destro: contatori, grafico barre per mese, festività, lista turni. Si apre cliccando su un dipendente in GraficoEquita.
7. `clean_db.sql` — nuovo script per svuotare tutti i dati senza toccare la struttura.
8. `layout.tsx` — rimosso Geist_Mono (fix warning font preload inutilizzato).

**Status:** Completato

---

### [2026-03-26] — CODE AGENT + UI AGENT + DOCS AGENT — Multi-area: bug fix area matching import, area_id su crea-utente e resolve, manager sync cambio ruolo, export Excel (nome file, A1, C51), ordinamento naturale aree, ricerca utenti, dashboard nome area

**File modificati:**
- `app/api/import-shifts/route.ts`
- `app/api/import-shifts/resolve/route.ts`
- `app/api/users/route.ts`
- `app/api/users/[id]/route.ts`
- `lib/excel/generateTurniExcel.ts`
- `components/admin/disponibilita/CalendarioGlobale.tsx`
- `lib/utils/sort.ts` (nuovo)
- `components/admin/utenti/ListaUtenti.tsx`
- `app/user/page.tsx`
- `components/admin/NavbarAdmin.tsx`
- Template rinominato: `AREA4.xlsx` → `template_turni.xlsx` su Supabase Storage

**Sommario:** Completamento multi-area: fix area matching a 3 livelli nell'import, area_id propagato correttamente in creazione utenti e resolve, cambio ruolo manager sincronizza automaticamente `areas.manager_id`, export Excel con nome file area-aware e team leader in C51, ordinamento naturale aree (Area1...Area10...Area11), ricerca utenti per nome, nome area in dashboard dipendente.

**Dettagli:**
1. `import-shifts/route.ts` — area matching ora a 3 livelli: esatto → prefisso ilike → normalizzato (rimozione spazi e lowercase). "AREA 6" ora matcha correttamente "Area6 - Veneto".
2. `import-shifts/resolve/route.ts` — Fix bug: usava `profile.area_id` (area admin = Default). Ora legge `area_id` dal body della request per assegnare il dipendente all'area corretta.
3. `users/route.ts` — Accetta `area_id` opzionale nel body; se il caller e admin, usa l'`area_id` dal body invece di quello del profilo admin.
4. `users/[id]/route.ts` — Fix cambio ruolo: se il nuovo ruolo e `manager`, aggiorna automaticamente `areas.manager_id` per l'area dell'utente. Se il ruolo scende da `manager`, rimuove `areas.manager_id` se era assegnato.
5. `generateTurniExcel.ts` — Nome file ora `Area4_Marzo_2026.xlsx` (parte corta del nome area senza spazi). Cella A1 scrive la parte prima di ` - ` in uppercase (es. "AREA 4"). Team leader scritto in C51 merged (C51:D52) invece di B51.
6. `CalendarioGlobale.tsx` — Fix navigazione mesi: query `month_status` ora filtra per `area_id`.
7. `lib/utils/sort.ts` — Nuovo file con funzione `sortByNome` usando `Intl.Collator({ numeric: true })`. Garantisce ordinamento naturale: Area1, Area2, ..., Area10, Area11.
8. `ListaUtenti.tsx` — Aggiunto campo "Cerca per nome" nella pagina utenti admin.
9. `app/user/page.tsx` — Nome area mostrato a destra del saluto nella dashboard dipendente.
10. `NavbarAdmin.tsx` — Fix warning: `import pkg from '@/package.json'; const version = pkg.version` per leggere la versione senza casting non sicuri.
11. Template Excel — Rinominato da `AREA4.xlsx` a `template_turni.xlsx` su Supabase Storage. Celle A1 e C51 svuotate per renderlo universale (vengono popolate a runtime da `generateTurniExcel`). Copia originale salvata in `docs/AREA4_originale.xlsx`.

**Status:** Completato

---

### [2026-03-25] — CODE AGENT + UI AGENT + DOCS AGENT — Multi-area: gestione aree UI, equità cross-area, export area-aware, fix seed

**File modificati:**
- `components/admin/aree/GestioneAree.tsx`
- `app/api/areas/[id]/route.ts` (nuovo)
- `app/api/equity-overview/route.ts` (nuovo)
- `app/admin/equita/page.tsx` (nuovo)
- `components/admin/NavbarAdmin.tsx`
- `lib/excel/generateTurniExcel.ts`
- `supabase/seed_demo.sql`

**Sommario:** Gestione aree con UX trasferimento manager; nuova pagina equità cross-area solo admin; export Excel area-aware (A1/B51 da DB); fix seed Area2-Liguria e nomi duplicati.

**Dettagli:**
1. `GestioneAree.tsx` — Dropdown manager mostra `Nome — NomeArea` se già assegnato altrove, solo `Nome` se libero. Banner ambra inline avvisa l'impatto del cambio prima del salvataggio. Nessun modal annidato.
2. `areas/[id]/route.ts` — PATCH con trasferimento manager in cascata: azzera `manager_id` dell'area precedente del nuovo manager e aggiorna `users.area_id` del nuovo manager alla nuova area.
3. `equity-overview/route.ts` — Nuova API GET che chiama `get_equity_scores` in parallelo per tutte le aree e ritorna array `AreaEquitySummary`.
4. `admin/equita/page.tsx` — Pagina solo admin con panoramica equità cross-area: score medio/min/max/delta per area, badge salute (verde ≤ 2, giallo 3–5, rosso > 5), ranking espandibile, filtro mese/anno.
5. `NavbarAdmin.tsx` — Voce "Equità" aggiunta per admin tra Aree e Sistema.
6. `generateTurniExcel.ts` — Scrive nome area in A1 e cognome manager in B51 letti dal DB tramite `areaId` (rimossi i valori hardcoded "AREA 4" e "Marco Lucchesi").
7. `seed_demo.sql` — Area2-Liguria: aggiunto `manager_id` mancante (Marco Ferrari). Nomi utenti resi unici con suffisso numerico per eliminare duplicati.

**Status:** Completato

---

### [2026-03-25] — CODE AGENT + UI AGENT — Multi-area: bug fix email settings, selettore area disponibilita, UI miglioramenti

**File modificati:**
- `app/api/email-settings/route.ts`
- `app/api/email-settings/[id]/route.ts`
- `app/admin/impostazioni/page.tsx`
- `app/admin/disponibilita/page.tsx`
- `components/admin/disponibilita/AreaSelector.tsx` (nuovo)
- `components/admin/utenti/ListaUtenti.tsx`
- `app/admin/page.tsx`

**Sommario:** Bug fix ownership email settings per area; selettore area su calendario disponibilita admin; miglioramenti UI filtri e dashboard.

**Dettagli:**
1. `email-settings/route.ts` POST — include `area_id` dal profilo utente nell'insert, garantendo che ogni manager crei email settings solo per la propria area.
2. `email-settings/[id]/route.ts` PATCH e DELETE — aggiunto filtro `.eq('area_id', authResult.areaId)` come ownership check: un manager non puo modificare o eliminare email settings di altre aree.
3. `admin/impostazioni/page.tsx` — query email_settings filtrata per `areaId` per visualizzare solo le proprie.
4. `admin/disponibilita/page.tsx` — accetta `searchParams`, fetcha tutte le aree se admin, usa `?area=<id>` come parametro per l'area attiva.
5. `AreaSelector.tsx` — nuovo componente `<select>` client-side che naviga tra aree tramite `router.push` con query string `?area=<id>`.
6. `ListaUtenti.tsx` — filtro area convertito da pill a `<select>` dropdown per migliore usabilita.
7. `admin/page.tsx` — aggiunto badge "Aree" (verde) accanto ad Area Manager e ATC nella sezione Utenti della dashboard admin.

**Status:** Completato

---

### [2026-03-24] — DOCS AGENT — Documentazione aggiornata

**File modificati:** `README.md`, `CLAUDE.md`, `docs/TODO.md`, `docs/ARCHITECTURE.md`

**Sommario:** Allineamento di tutta la documentazione alle feature completate dopo v1.2.0 (email Brevo, mesi confirmed, sblocco admin, festività anni futuri, migration 011 areas, API config).

---

### [2026-03-23] — CODE AGENT + UI AGENT — Email turni Brevo + Mesi confirmed

**Versione:** 1.2.0 → 1.3.0

**File modificati:**
- `lib/email/sendTurniEmail.ts` (nuovo)
- `lib/excel/generateTurniExcel.ts` (estratto da export/route.ts)
- `app/api/export/route.ts`
- `app/api/send-email/route.ts` (nuovo)
- `components/admin/export/ExportForm.tsx`
- `components/admin/disponibilita/CalendarioGlobale.tsx`
- `app/api/month/route.ts`

**Sommario:** Implementazione email turni via Brevo con allegato Excel; mesi `confirmed` resi immutabili per manager (solo admin puo sbloccare); admin aggiunto alla navbar Disponibilita.

**Dettagli:**
1. `sendTurniEmail.ts` — Invia email Brevo con tabella turni HTML + allegato Excel base64. `to` = mittente, `bcc` = dipendenti attivi + email_settings. Env vars: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.
2. `generateTurniExcel.ts` — Logica generazione XLSX estratta da `export/route.ts` e condivisa con `send-email/route.ts`.
3. `export/route.ts` — Auto-invio email se `!email_inviata` dopo il download; setta `confirmed` + `email_inviata=true`.
4. `send-email/route.ts` — Invio manuale da ExportForm; genera Excel + invia email + setta `confirmed` + `email_inviata=true`.
5. `ExportForm.tsx` — Bottone "Invia email" + stato "Email inviata ✓".
6. `CalendarioGlobale.tsx` — Prop `isConfirmed` separata da `locked`; mese `confirmed` = nessun unlock per manager; admin vede bottone "Sblocca" con dialog di conferma.
7. `month/route.ts` — Unlock resetta `email_inviata=false`, `email_inviata_at=null`.

**Status:** Completato

---

### [2026-03-22] — UI AGENT — Fix: Logout admin su mobile + Performance: loading skeleton + SSR StoricoTurni

**Versione:** 1.1.0 → 1.2.0

**File modificati:**
- `components/admin/NavbarAdmin.tsx`
- `components/AdminPageSkeleton.tsx` (nuovo)
- `app/admin/loading.tsx` (nuovo)
- `app/admin/disponibilita/loading.tsx` (nuovo)
- `app/admin/turni/loading.tsx` (nuovo)
- `app/admin/utenti/loading.tsx` (nuovo)
- `app/admin/statistiche/loading.tsx` (nuovo)
- `app/admin/sistema/loading.tsx` (nuovo)
- `app/admin/export/loading.tsx` (nuovo)
- `app/admin/impostazioni/loading.tsx` (nuovo)
- `app/user/loading.tsx` (nuovo)
- `app/user/impostazioni/loading.tsx` (nuovo)
- `components/user/StoricoTurni.tsx`
- `app/user/page.tsx`

**Sommario:** Fix logout mobile per il ruolo admin; aggiunta copertura skeleton loading su tutte le pagine SSR; conversione StoricoTurni da client component a server component.

**Dettagli:**

1. `NavbarAdmin.tsx` — Bug fix: il pulsante "Altro" nella bottom bar mobile era condizionalmente nascosto quando `moreItems` era un array vuoto (caso admin). Il pulsante e ora sempre renderizzato, garantendo accesso al logout anche per il ruolo admin che non ha voci secondarie nel menu overflow.

2. `AdminPageSkeleton.tsx` — Nuovo componente condiviso che riproduce l'intera struttura layout (sidebar desktop 224px, content area, bottom nav mobile) con blocchi `animate-pulse`. Accetta due prop: `rows` (numero di card skeleton, default 3) e `grid` (layout a 2 colonne invece di lista verticale, default false).

3. `loading.tsx` per tutte le pagine admin — Ogni route admin ora ha un `loading.tsx` che Next.js mostra istantaneamente durante il caricamento SSR, eliminando la pagina bianca. Le pagine con layout a 2 colonne (disponibilita, sistema) usano `grid={true}`; le altre usano il default verticale con `rows` calibrato sulla densita di contenuto della pagina.

4. `app/user/loading.tsx` e `app/user/impostazioni/loading.tsx` — Skeleton inline per le pagine utente (layout diverso da admin: navbar top + niente sidebar). Lo skeleton di `/user` include una griglia calendario 7 colonne x 5 righe piu la sezione storico.

5. `StoricoTurni.tsx` — Convertito da client component (con `useEffect` + `fetch` verso API) a server component puro. Il componente riceve `turni: ShiftRow[]` come prop da `app/user/page.tsx`. Mantiene vista mobile (card) e vista desktop (table) con le stesse informazioni: data, tipo turno, stato mese.

6. `app/user/page.tsx` — Aggiunta quinta query nel `Promise.all` esistente: shifts degli ultimi 12 mesi ordinati per data decrescente. Il join con `month_status` avviene in memoria tramite una `statusMap` (chiave `"anno-mese"` → status). `allMonthStatuses` e riutilizzato sia per il calcolo `lockedMonths` (calendario) che per il join storico, evitando query duplicate.

**Status:** Completato

---

### [2026-03-22] — CODE AGENT — Refactor: Type Safety

**Versione:** 1.0.x → 1.1.0

**File modificati:**
- `lib/supabase/types.ts`
- `app/api/month/route.ts`
- `app/api/export/route.ts`
- `components/admin/sistema/GestioneTemplate.tsx`
- tutte le API route (`app/api/**/*.ts`)
- `components/admin/NavbarAdmin.tsx`
- `package.json`

**Sommario:** Refactor completo della type safety su tutto il codebase per compatibilita con TypeScript 5.9 + Supabase JS v2.

**Dettagli:**

1. `lib/supabase/types.ts` — tutti gli `export interface` convertiti in `export type`; aggiunti `Relationships` a ogni tabella; aggiunti `Views`, `Enums`, `CompositeTypes` al tipo `Database` (struttura richiesta da Supabase JS v2).
2. Rimossi 38 commenti `eslint-disable-next-line @typescript-eslint/no-explicit-any` dalle API route.
3. Rimossi tutti i cast `as any` dal codebase.
4. Rimossi ~40 cast ridondanti `as Type` su risultati di query Supabase (es. `(data ?? []) as Shift[]` diventa `data ?? []` grazie ai tipi inferiti correttamente).
5. Corretti 4 bug reali emersi dopo la rimozione dei cast:
   - `month/route.ts`: status literals narrowati con `as const` per soddisfare il tipo union
   - `export/route.ts`: `.upsert()` sostituito con `.update()` — il metodo corretto per aggiornare un record esistente con tipizzazione stretta
   - `GestioneTemplate.tsx`: valori `null` convertiti in `undefined` tramite `?? undefined` per compatibilita con le prop dei componenti React
6. Versione aggiornata a `1.1.0` in `package.json`; la versione viene ora letta da `package.json` e mostrata nella sidebar admin (`NavbarAdmin.tsx`).
