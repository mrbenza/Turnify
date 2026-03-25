# ARCHITECTURE.md — Turnify

Mappa tecnica completa dell'applicazione. Usare come riferimento prima di modificare qualsiasi file.
Aggiornare dopo ogni modifica strutturale significativa.

---

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Next.js 15 App Router (Vercel) |
| Backend | Next.js API Routes (server-side) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email + password) |
| Storage | Supabase Storage (bucket `templates`) |
| Email | Brevo SMTP API |
| Excel | JSZip (manipolazione XML interno .xlsx) |

---

## Schema Database

### `users`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | = auth.users.id |
| nome | text | "Nome Cognome" |
| email | text UNIQUE | |
| ruolo | enum | `admin` \| `manager` \| `dipendente` |
| attivo | boolean | default true |
| data_creazione | timestamptz | default now() |
| disattivato_at | timestamptz\|null | |

### `holidays`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | |
| date | date UNIQUE | |
| name | text | |
| mandatory | boolean | true = usata in score + shift_type |
| year | int | GENERATED ALWAYS from date |

### `month_status`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | |
| month | int | 1–12 |
| year | int | |
| status | enum | `open` \| `locked` \| `confirmed` |
| locked_by | uuid\|null | FK users |
| locked_at | timestamptz\|null | |
| email_inviata | boolean | default false |
| email_inviata_at | timestamptz\|null | |
| area_id | uuid FK areas | area di riferimento (migration 013) |
| — | UNIQUE(month, year, area_id) | ogni area ha il proprio stato mensile |

**Semantica status:**
- `open` → modificabile, nessun lock
- `locked` → bloccato dal manager, sbloccabile (da manager o admin)
- `confirmed` → definitivo dopo export Excel o invio email; sbloccabile solo da admin

### `availability`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | |
| user_id | uuid FK users | |
| date | date | |
| available | boolean | |
| status | enum | `pending` \| `approved` \| `locked` |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger auto-update |
| — | UNIQUE(user_id, date) | |

### `shifts`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | |
| date | date | |
| user_id | uuid FK users | |
| user_nome | text\|null | denormalizzato, preserva nome se user cancellato |
| shift_type | enum | `weekend` \| `festivo` \| `reperibilita` |
| created_by | uuid FK users | |
| created_at | timestamptz | |
| — | UNIQUE(date, user_id) | |

**Logica shift_type:** festivo se `holidays.mandatory=true` per quella data, weekend se sabato/domenica, altrimenti reperibilita.

### `email_settings`
| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid PK | |
| email | text UNIQUE | |
| descrizione | text\|null | |
| attivo | boolean | default true |
| created_at | timestamptz | |

---

## DB Functions & RLS

### Functions
```sql
is_admin() → boolean                          -- RLS helper
is_admin_or_manager() → boolean               -- RLS helper
get_equity_scores(p_month int, p_year int)    -- RPC usata da statistiche
  → { user_id, nome, turni_totali, festivi, score }
  -- score = turni_totali + festivi*2
  -- p_month=0 → all-time (ignora filtro mese/anno)
```

### RLS (sintesi)
| Tabella | Dipendente | Manager | Admin |
|---------|-----------|---------|-------|
| users | legge self | legge tutti, modifica dipendenti | tutto |
| holidays | legge | legge | tutto |
| month_status | legge | legge + write | tutto |
| availability | proprie (pending) | tutto | tutto |
| shifts | proprie | tutto | tutto |
| email_settings | — | legge + write (service) | tutto |

> **Nota:** le operazioni sensibili (email_settings, users creation) usano `serviceClient` (service role) per bypassare RLS.

---

## API Routes

### Auth & Ruoli
Ogni route verifica: `supabase.auth.getUser()` → poi query `users.ruolo`. Usa `createClient()` per il check auth, `createServiceClient()` per operazioni privilegiate.

### Tabella Routes

| Route | Metodo | Auth | Cosa fa |
|-------|--------|------|---------|
| `/api/availability` | POST | dipendente | Crea/aggiorna disponibilità. Blocca se mese locked/approved |
| `/api/shifts` | POST | admin/manager | Assegna turno. Calcola shift_type. Blocca se mese locked |
| `/api/shifts/[id]` | DELETE | admin/manager | Elimina turno. Blocca se mese locked |
| `/api/users` | POST | admin/manager | Crea utente (auth + db). Rollback se DB fallisce |
| `/api/users/[id]` | PATCH | admin/manager | Modifica ruolo (admin only) o attivo/disattivato_at |
| `/api/users/[id]` | DELETE | admin | Elimina utente. Richiede attivo=false |
| `/api/month` | POST | admin/manager | Lock (`locked`) o unlock (`open`) mese. Unlock resetta email_inviata=false |
| `/api/holidays` | GET | admin/manager | Lista festività |
| `/api/holidays` | POST | admin | Crea manuale o import da Nager.Date API |
| `/api/holidays/[id]` | PATCH | admin | Modifica mandatory |
| `/api/holidays/[id]` | DELETE | admin | Elimina (blocca se shifts esistono in quella data) |
| `/api/export` | GET | admin/manager | Genera XLSX dal template, setta `confirmed`, invia email se !email_inviata |
| `/api/send-email` | POST | admin/manager | Genera XLSX, invia email con allegato, setta `confirmed` + email_inviata=true |
| `/api/email-settings` | POST | admin/manager | Crea indirizzo extra notifiche; include `area_id` nel profilo e nell'insert — isolamento per area |
| `/api/email-settings/[id]` | PATCH | admin/manager | Toggle attivo; filtra con `.eq('area_id', authResult.areaId)` — ownership check per area |
| `/api/email-settings/[id]` | DELETE | admin/manager | Elimina; filtra con `.eq('area_id', authResult.areaId)` — ownership check per area |
| `/api/templates` | POST | admin | Upload .xlsx a Storage bucket `templates` |
| `/api/import-shifts` | POST | admin | Importa storico da Excel. Mappa cognomi → user_id. Setta confirmed/locked |
| `/api/import-shifts/resolve` | POST | admin | Risolve turni pending (utente non trovato al momento dell'import) |
| `/api/config` | GET | admin/manager | Legge `scheduling_mode` e `workers_per_day` dalla tabella `areas` (riga Default) |
| `/api/config` | PATCH | admin/manager | Aggiorna `scheduling_mode` e/o `workers_per_day` |
| `/api/areas/[id]` | PATCH | admin | Modifica area (nome, scheduling_mode, manager). Trasferimento manager in cascata: azzera `manager_id` dell'area precedente del nuovo manager; aggiorna `users.area_id` del nuovo manager |
| `/api/equity-overview` | GET | admin | Carica `get_equity_scores` in parallelo per tutte le aree; ritorna array `AreaEquitySummary` (n. dipendenti, score medio/min/max, delta) |

---

## Lib condivise

### `lib/supabase/server.ts`
```typescript
createClient()        // server component + API routes (usa cookies)
createServiceClient() // service role, mai esposto al browser
```

### `lib/supabase/client.ts`
```typescript
createClient() // browser only, client components
```

### `lib/excel/generateTurniExcel.ts`
```typescript
generateTurniExcel(month, year, serviceClient, templateName?, areaId?)
  → { buffer: Buffer, fileName: string }
```
- Query shifts + users dal DB (filtrati per `areaId` se fornito)
- Recupera nome area e cognome manager da DB tramite `areaId`
- Scarica template da Storage bucket `templates`
- Trova foglio "Dati" via workbook.xml + rels
- Popola celle: **A1** (nome area), A3 (serial primo giorno), C5 (serial oggi), A10-A40 (date), D10-E40 (cognomi, rossi se weekend), **B51** (cognome manager)
- A1 e B51 erano hardcoded ("AREA 4", "Marco Lucchesi") — ora letti dal DB tramite `areaId`
- Rimuove calcChain.xml
- Restituisce buffer + nome file

### `lib/email/sendTurniEmail.ts`
```typescript
sendTurniEmail({ month, year, shiftsByDate, recipients, excelBuffer?, excelFileName? })
  → Promise<void>
```
- Costruisce HTML tabella turni + versione testo
- Chiama Brevo API (`POST https://api.brevo.com/v3/smtp/email`)
- `to` = solo mittente (BREVO_SENDER_EMAIL), `bcc` = tutti i destinatari (nessuno si vede tra loro)
- Allega Excel in base64 se excelBuffer fornito
- Env vars richieste: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`

### `lib/supabase/types.ts`
```typescript
UserRole = 'admin' | 'manager' | 'dipendente'
AvailabilityStatus = 'pending' | 'approved' | 'locked'
ShiftType = 'weekend' | 'festivo' | 'reperibilita'
MonthStatusValue = 'open' | 'locked' | 'confirmed'

User, Holiday, MonthStatus, Availability, Shift, EmailSetting, EquityScore
Database  // tipo completo Supabase con Tables + Functions
```

---

## Pagine & Componenti

### Admin — Pagine (server components)

| Pagina | Ruolo | Query principali | Componenti montati |
|--------|-------|-----------------|-------------------|
| `/admin` | admin/manager | users, auth.listUsers, storage templates (admin) oppure month_status, shifts, availability (manager) | Dashboard diversa per ruolo |
| `/admin/disponibilita` | admin/manager | users attivi, availability, shifts, holidays, month_status mese corrente; accetta `searchParams.area` per filtrare per area | `CalendarioGlobale`, `AreaSelector` |
| `/admin/turni` | admin/manager | users, shifts, month_status mese corrente | `ListaTurni` |
| `/admin/export` | admin/manager | users, storage templates | `ExportForm` |
| `/admin/utenti` | admin/manager | users (tutti), auth.listUsers (last login) | `ListaUtenti` |
| `/admin/statistiche` | admin/manager | RPC get_equity_scores mese corrente | `GraficoEquita` |
| `/admin/impostazioni` | admin/manager | email_settings | `GestioneEmail` |
| `/admin/sistema` | admin | storage templates, holidays | `GestioneTemplate`, `AggiornamentoCalendario`, `ImportaStorico` |
| `/admin/equita` | admin | `/api/equity-overview` → `get_equity_scores` per tutte le aree | `PanoramicaEquita` (inline) |

**Nota `/admin/equita`:** accessibile solo ad admin. Mostra per ogni area: n. dipendenti, score medio/min/max, delta. Badge salute: verde (delta ≤ 2), giallo (3–5), rosso (> 5). Ogni riga è espandibile per vedere il ranking completo dei dipendenti. Filtro mese/anno con toggle "Questo mese / Tutti i tempi".

### Admin — Componenti chiave (client components)

#### `GestioneAree` (`components/admin/aree/GestioneAree.tsx`)
Modal "Modifica area": dropdown manager mostra `Nome — NomeArea` se il manager è già assegnato ad un'altra area, solo `Nome` se libero. Banner inline ambra se si seleziona un manager già assegnato altrove (avvisa che l'area precedente perderà il manager al salvataggio). Nessun modal annidato — "Salva modifiche" fa da conferma implicita. Al salvataggio chiama PATCH `/api/areas/[id]`.

#### `CalendarioGlobale`
Props: `initialUsers, initialAvailability, initialShifts, initialHolidays, initialMonth (0-based), initialYear, initialLocked, initialConfirmed, isAdmin`

**Stato locked/confirmed:**
- `locked=true` → cella non modificabile, nessun assign/remove
- `isConfirmed=true` → mostra badge "Mese confermato", nessun bottone "Annulla conferma"
- `isAdmin=true && isConfirmed=true` → mostra bottone "Sblocca" (admin può sbloccare anche confirmed)
- `isConfirmed=false && locked=true` → mostra "Annulla conferma" (manager può sbloccare locked)

**Navigazione mese:** fetch parallelo availability + shifts + holidays + month_status, aggiorna tutti gli stati inclusi locked/confirmed.

#### `ExportForm`
Props: `users, templates`

Flusso: seleziona mese/anno → opzionale: carica anteprima → "Genera Excel" (GET /api/export) oppure "Invia email" (POST /api/send-email). Lo stato `emailInviata` viene verificato al cambio periodo.

#### `ListaTurni`
Props: `initialShifts (enriched con userName), initialMonth, initialYear, initialLocked, users`

Raggruppa automaticamente Sab+Dom in riga unica weekend. Filtro mese/anno client-side.

### User — Pagine

| Pagina | Query | Componenti |
|--------|-------|-----------|
| `/user` | availability (mese corrente+prossimo), holidays, shifts, month_status (tutti), storico shifts 12 mesi | `CalendarioDisponibilita`, `StoricoTurni` |
| `/user/impostazioni` | — | `ImpostazioniPassword` |

---

## Flussi Business Principali

### 1. Assegnazione turno (manager)
```
CalendarioGlobale click cella
  → POST /api/shifts { date, userId }
  → verifica mese non locked
  → calcola shift_type (festivo > weekend > reperibilita)
  → INSERT shifts (con user_nome denormalizzato)
  → update UI ottimistico
```

### 2. Lock/conferma mese
```
"Conferma e blocca" button
  → POST /api/month { month, year, action: 'lock' }
  → UPDATE month_status SET status='locked'
  → setLocked(true), setIsConfirmed(false)
```

### 3. Export Excel + auto-email
```
"Genera Excel" button (ExportForm)
  → GET /api/export?month=X&year=Y&template=name
  → verifica status locked|confirmed
  → generateTurniExcel() → buffer
  → UPDATE availability pending→approved
  → UPDATE month_status status='confirmed'
  → se !email_inviata → sendTurniEmail() con allegato Excel
    → UPDATE email_inviata=true
  → restituisce file per download
```

### 4. Invio email manuale
```
"Invia email" button (ExportForm)
  → POST /api/send-email { month, year }
  → verifica status locked|confirmed
  → generateTurniExcel() + fetch recipients (dipendenti + email_settings)
  → sendTurniEmail() con allegato Excel, BCC per tutti
  → UPDATE month_status status='confirmed', email_inviata=true
```

### 5. Sblocco admin su mese confirmed
```
"Sblocca" button (CalendarioGlobale, solo isAdmin=true)
  → dialog conferma (testo specifico per confirmed)
  → POST /api/month { action: 'unlock' }
  → UPDATE month_status status='open', locked_by=null, email_inviata=false
  → setLocked(false), setIsConfirmed(false)
```

### 6. Import storico
```
Upload .xlsx (ImportaStorico)
  → POST /api/import-shifts (FormData)
  → parsea ZIP, legge foglio "Dati"
  → estrae mese da cella A3 (Excel serial date)
  → per ogni riga 10-40: legge D/E (cognomi)
  → match cognome → user_id (cognomeMap)
  → unmatched → pendingShifts (modal per creazione utente al volo)
  → INSERT shifts (upsert ignoreDuplicates)
  → UPDATE month_status: past→confirmed, current→locked
```

---

## Convenzioni Codice

### TypeScript
- Zero `any`, zero `eslint-disable`
- Tipi `export type` (non interface) in types.ts — richiesto da Supabase JS v2
- `as const` per narroware status literals su union type
- Cast `as MonthStatusValue` solo quando necessario per narrowing

### Supabase Client
- `createClient()` → server components e API routes (cookie-based auth)
- `createServiceClient()` → operazioni privilegiate in API routes (bypassa RLS)
- `createClient()` da `lib/supabase/client.ts` → solo client components

### Creazione utenti — regola critica

In produzione usare **sempre** `serviceClient.auth.admin.createUser()` (equivalente a `POST /auth/v1/admin/users` con service role key). L'admin API crea automaticamente il record in `auth.identities`, che GoTrue richiede obbligatoriamente per autenticare via email+password. Un INSERT SQL diretto in `auth.users` senza il corrispondente INSERT in `auth.identities` causa errore 500 "Database error querying schema" o "Database error loading user" al login.

**Solo in seed SQL / test:** è ammesso l'insert diretto, ma richiede due operazioni:
1. INSERT in `auth.users` con `instance_id='00000000-0000-0000-0000-000000000000'`, `raw_user_meta_data='{"email_verified":true}'`, e tutti i token come `''` (stringa vuota, non NULL).
2. INSERT in `auth.identities` con `provider='email'` e `identity_data` contenente `sub`, `email`, `email_verified`, `phone_verified`.

Riferimento: `supabase/seed_demo.sql` (esempio corretto già presente).

### Gestione errori
- Supabase non lancia eccezioni → controllare sempre `{ data, error }`
- try/catch sui fetch client-side
- Errori non bloccanti (email, status update) loggati ma non propagati

### Mese
- **0-indexed** nelle props React e nei `useState` (come `Date.getMonth()`)
- **1-indexed** nel DB e nelle API (come SQL `BETWEEN 1 AND 12`)
- Conversione: `viewMonth + 1` quando si chiama API

---

## Variabili d'Ambiente

| Variabile | Scope | Uso |
|-----------|-------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | chiave anonima |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | service role (mai esposta) |
| `BREVO_API_KEY` | server only | Brevo SMTP |
| `BREVO_SENDER_EMAIL` | server only | mittente email (verificato su Brevo) |
| `BREVO_SENDER_NAME` | server only | nome mittente (default: "Turnify") |

---

## Struttura Cartelle

```
turnify/
├── app/
│   ├── api/
│   │   ├── availability/route.ts
│   │   ├── shifts/route.ts + [id]/route.ts
│   │   ├── users/route.ts + [id]/route.ts
│   │   ├── month/route.ts
│   │   ├── holidays/route.ts + [id]/route.ts
│   │   ├── export/route.ts
│   │   ├── send-email/route.ts
│   │   ├── email-settings/route.ts + [id]/route.ts
│   │   ├── templates/route.ts
│   │   ├── import-shifts/route.ts
│   │   ├── import-shifts/resolve/route.ts
│   │   ├── areas/[id]/route.ts           ← PATCH modifica area + trasferimento manager cascata
│   │   └── equity-overview/route.ts      ← GET panoramica equità cross-area
│   ├── admin/
│   │   ├── page.tsx (dashboard)
│   │   ├── disponibilita/page.tsx
│   │   ├── turni/page.tsx
│   │   ├── export/page.tsx
│   │   ├── utenti/page.tsx
│   │   ├── statistiche/page.tsx
│   │   ├── impostazioni/page.tsx
│   │   ├── sistema/page.tsx
│   │   └── equita/page.tsx               ← panoramica equità cross-area (solo admin)
│   ├── user/
│   │   ├── page.tsx
│   │   └── impostazioni/page.tsx
│   └── login/ + forgot-password/ + reset-password/
├── components/
│   ├── admin/
│   │   ├── NavbarAdmin.tsx               ← voce "Equità" aggiunta per admin (tra Aree e Sistema)
│   │   ├── disponibilita/CalendarioGlobale.tsx
│   │   ├── disponibilita/AreaSelector.tsx
│   │   ├── turni/ListaTurni.tsx
│   │   ├── export/ExportForm.tsx
│   │   ├── utenti/ListaUtenti.tsx + AddUserModal.tsx
│   │   ├── statistiche/GraficoEquita.tsx
│   │   ├── impostazioni/GestioneEmail.tsx
│   │   ├── sistema/GestioneTemplate.tsx + AggiornamentoCalendario.tsx + ImportaStorico.tsx
│   │   ├── aree/GestioneAree.tsx         ← modal modifica area con dropdown manager e banner ambra
│   │   └── dashboard/TurniCollapsibili.tsx
│   └── user/
│       ├── NavbarUtente.tsx
│       ├── CalendarioDisponibilita.tsx
│       ├── StoricoTurni.tsx
│       └── ImpostazioniPassword.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts   (createClient, createServiceClient)
│   │   ├── client.ts   (createClient browser)
│   │   └── types.ts    (tutti i tipi)
│   ├── excel/
│   │   └── generateTurniExcel.ts
│   ├── email/
│   │   └── sendTurniEmail.ts
│   └── utils/
│       └── dates.ts
├── docs/
│   ├── ARCHITECTURE.md  (questo file)
│   ├── TODO.md
│   └── AGENTS.md
└── supabase/
    ├── schema_completo.sql
    ├── seed_demo.sql
    ├── reset.sql
    └── migrations/
        ├── 001–010_*.sql   (schema iniziale, RLS, ruoli, score equita)
        ├── 011_areas.sql   (tabella areas: scheduling_mode, workers_per_day, template_path, manager_id; riga Default)
        ├── 012_reperibile_order.sql  (colonna reperibile_order su shifts: 1=col D, 2=col E)
        └── 013_multi_area.sql  (area_id su users/shifts/availability/month_status; unique month+year+area_id)
```
