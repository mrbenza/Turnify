# Turnify — Gestione Turni di Reperibilita

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
| Email | Resend | Da implementare |

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
│   ├── user/page.tsx                ← dashboard dipendente
│   ├── admin/
│   │   ├── page.tsx                 ← dashboard admin/manager
│   │   ├── disponibilita/page.tsx   ← calendario globale (manager)
│   │   ├── turni/page.tsx           ← lista turni (non in navbar manager)
│   │   ├── statistiche/page.tsx     ← score equita (manager only)
│   │   ├── export/page.tsx          ← "Invio turni" — genera Excel (manager)
│   │   ├── utenti/page.tsx          ← gestione utenti (admin + manager)
│   │   ├── sistema/page.tsx         ← template, festivita, import storico (admin only)
│   │   └── impostazioni/page.tsx    ← email notifiche (manager)
│   └── api/
│       ├── shifts/route.ts          ← GET lista turni, POST assegna
│       ├── shifts/[id]/route.ts     ← DELETE rimuovi turno
│       ├── availability/route.ts    ← GET/POST disponibilita
│       ├── month/route.ts           ← GET/POST stato mese (lock/unlock)
│       ├── export/route.ts          ← GET genera XLSX da template + imposta status 'confirmed'
│       ├── import-shifts/route.ts   ← POST importa storico da XLSX (JSZip)
│       ├── holidays/route.ts        ← GET/POST/DELETE gestione festivita
│       ├── email-settings/route.ts  ← GET/POST indirizzi email extra
│       ├── email-settings/[id]/route.ts ← DELETE
│       ├── dipendentes/route.ts     ← POST crea nuovo utente
│       └── dipendentes/[id]/route.ts ← PATCH (attivo/ruolo), DELETE
├── components/
│   ├── auth/AuthGuard.tsx           ← timeout sessione automatico
│   ├── user/
│   │   ├── NavbarUtente.tsx
│   │   ├── CalendarioDisponibilita.tsx
│   │   └── StoricoTurni.tsx
│   └── admin/
│       ├── NavbarAdmin.tsx          ← sidebar desktop + bottom bar mobile; nav diversa per admin vs manager
│       ├── dashboard/
│       │   └── TurniCollapsibili.tsx ← sezione turni collassabile nella dashboard manager
│       ├── disponibilita/
│       │   └── CalendarioGlobale.tsx
│       ├── turni/
│       │   └── ListaTurni.tsx       ← weekend Sab+Dom raggruppati in una riga
│       ├── statistiche/
│       │   └── GraficoEquita.tsx
│       ├── export/
│       │   └── ExportForm.tsx       ← anteprima grafica + genera Excel
│       ├── utenti/
│       │   └── ListaUtenti.tsx      ← prop isManager: se true, ruolo non modificabile
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
│   │   └── types.ts
│   └── utils/
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
        └── 010_simplify_equity_scores.sql
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
   Download → month_status → 'confirmed'.
   [TODO] Invio email automatico via Resend.

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
| data_creazione | timestamptz | default now() |

### `availability`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| date | date | giorno di disponibilita |
| available | boolean | |
| status | text | `pending` \| `approved` \| `locked` |

### `shifts`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| date | date | giorno del turno |
| user_id | uuid | FK → users.id |
| shift_type | text | `weekend` \| `festivo` \| `reperibilita` |
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
| locked_by | uuid | FK → users.id |
| locked_at | timestamptz | |
| email_inviata | boolean | default false |
| email_inviata_at | timestamptz | nullable |

Status:
- `open` — in lavorazione
- `locked` — confermato dal manager, pronto per export
- `confirmed` — Excel generato/scaricato (impostato automaticamente da `/api/export`)

### `email_settings`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| email | text | unique |
| descrizione | text | nullable |
| attivo | boolean | default true |

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

- Row Level Security (RLS) abilitata su tutte le tabelle Supabase
- `is_admin_or_manager()` — funzione SQL usata nelle policy per operazioni che richiedono ruolo elevato
- Il frontend usa il client Supabase con chiave `anon`; le operazioni privilegiate usano la `service_role` key solo nelle API route server-side Next.js
- `AuthGuard.tsx` gestisce il timeout automatico della sessione lato frontend
- `userId` e ruolo non transitano mai dal browser — vengono letti dalla sessione server-side

---

## Variabili d'ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=          # da aggiungere quando si implementa l'email
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

### Alta priorita
- Email notifica mese confermato via Resend: `email_settings` gia pronta, colonne `email_inviata`/`email_inviata_at` gia su `month_status`, aggiungere `RESEND_API_KEY`

### Media priorita
- Multi-area: tabella `areas` (nome, scheduling_mode, template_path, manager_id) + `area_id` su users/shifts/availability/month_status. Scheduling modes: `weekend_full` (attuale), `single_day`, `sun_next_sat`

### Bassa priorita
- Festivita anni futuri (attualmente solo 2026)
- Rotazione festivi comandati (chi lavora Natale non lo riprende per ~10 anni)
