# Turnify — Gestione Turni di Reperibilità

Web app per la gestione dei turni di reperibilità dei dipendenti. Permette ai dipendenti di segnare la propria disponibilità su un calendario e all'amministratore di assegnare i turni garantendo una rotazione equa, con export Excel e notifiche email.

---

## Stack tecnico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| Frontend | Next.js 15 + React 19 + Tailwind CSS | Hosted su Vercel (free) |
| Database | Supabase PostgreSQL | Free tier |
| Auth | Supabase Auth | Email + password |
| Email | Resend | Da implementare — 3000 email/mese gratis |
| Export | libreria `xlsx` | Template Excel da definire |

---

## Struttura del progetto

```
turnify/
├── README.md                        ← questo file
├── CLAUDE.md                        ← istruzioni per gli agenti AI
│
├── docs/                            ← documentazione agenti e schema DB
│   ├── AGENTS.md                    ← ruoli e regole degli agenti
│   └── SHEET_SCHEMA.md              ← schema database Supabase
│
├── app/                             ← Next.js App Router
│   ├── page.tsx                     ← redirect a /login
│   ├── layout.tsx                   ← layout globale
│   ├── globals.css
│   ├── login/
│   │   └── page.tsx                 ← pagina login
│   ├── user/
│   │   └── page.tsx                 ← dashboard dipendente
│   ├── admin/
│   │   ├── page.tsx                 ← dashboard admin (panoramica)
│   │   ├── disponibilita/page.tsx   ← calendario globale + assegnazione
│   │   ├── turni/page.tsx           ← lista turni assegnati
│   │   ├── statistiche/page.tsx     ← grafici equità
│   │   ├── export/page.tsx          ← scarica Excel/CSV
│   │   ├── utenti/page.tsx          ← gestione dipendenti
│   │   └── impostazioni/page.tsx    ← email e configurazioni
│   └── api/                         ← backend server-side (API routes)
│       ├── shifts/
│       │   ├── route.ts             ← GET lista turni, POST assegna turno
│       │   └── [id]/route.ts        ← DELETE rimuovi turno
│       ├── availability/
│       │   └── route.ts             ← GET/POST disponibilità dipendente
│       ├── month/
│       │   └── route.ts             ← GET/POST stato mese (lock, approve)
│       ├── email-settings/
│       │   ├── route.ts             ← GET lista email, POST aggiungi
│       │   └── [id]/route.ts        ← DELETE rimuovi email
│       └── users/
│           └── [id]/route.ts        ← PATCH aggiorna utente (attivo/ruolo)
│
├── components/
│   ├── user/
│   │   ├── NavbarUtente.tsx         ← header + logout
│   │   ├── CalendarioDisponibilita.tsx  ← calendario interattivo utente
│   │   └── StoricoTurni.tsx         ← storico turni personale
│   └── admin/
│       ├── NavbarAdmin.tsx          ← sidebar navigazione admin
│       ├── disponibilita/
│       │   └── CalendarioGlobale.tsx    ← griglia tutti dipendenti
│       ├── turni/
│       │   └── ListaTurni.tsx
│       ├── statistiche/
│       │   └── GraficoEquita.tsx
│       ├── export/
│       │   └── ExportForm.tsx
│       ├── utenti/
│       │   └── ListaUtenti.tsx
│       └── impostazioni/
│           └── GestioneEmail.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                ← Supabase browser client
│   │   ├── server.ts                ← Supabase server client + service role
│   │   └── types.ts                 ← tipi TypeScript dello schema DB
│   └── utils/
│       └── dates.ts                 ← utility condivise per date
│
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql   ← schema completo + RLS + festività 2026
        ├── 002_fix_month_status_rls.sql  ← fix policy INSERT
        └── 003_fix_equity_scores.sql    ← fix filtro mese RPC
```

---

## Ruoli utente

| Ruolo | Accesso | Permessi |
|-------|---------|---------|
| `user` | `/user` | Segna disponibilità, vede storico turni personali |
| `admin` | `/admin/*` | Assegna turni, conferma mesi, gestisce utenti, esporta dati |

---

## Flusso operativo

```
1. Dipendente accede a /user
   └─ Segna disponibilità su calendario (Sab/Dom/Festività)
      └─ Può modificare fino a quando il mese non è confermato

2. Admin accede a /admin/disponibilita
   └─ Vede calendario globale con disponibilità di tutti
   └─ Clicca su una cella per aprire drawer e assegnare turno
   └─ Controlla statistiche equità su /admin/statistiche

3. Admin conferma il mese
   └─ Validazione: tutti i weekend devono avere almeno 1 turno
   └─ Month status → "locked"
   └─ I dipendenti non possono più modificare la disponibilità

4. [TODO] Admin invia email
   └─ Notifica a tutti i dipendenti + indirizzi in email_settings
   └─ Dopo invio: rollback non più possibile

5. Admin scarica Excel
   └─ /admin/export → CSV del mese (template personalizzato da implementare)
```

---

## Database — Tabelle principali

| Tabella | Descrizione |
|---------|-------------|
| `users` | Anagrafica utenti (id = Supabase Auth UUID) |
| `availability` | Disponibilità segnate dai dipendenti |
| `shifts` | Turni assegnati dall'admin |
| `holidays` | Festività (mandatory = da distribuire equamente) |
| `month_status` | Stato del mese (open / approved / locked) |
| `email_settings` | Indirizzi email aggiuntivi per notifiche |

Vedi `SHEET_SCHEMA.md` per lo schema completo con tipi, RLS e constraint.

---

## Sicurezza

- **Row Level Security (RLS)** attiva su tutte le tabelle Supabase
- I dipendenti vedono e modificano **solo i propri dati**
- Solo gli admin possono scrivere su `shifts`, `month_status`, `email_settings`
- Le chiavi `NEXT_PUBLIC_*` sono visibili al browser — la sicurezza è garantita da RLS
- La `SUPABASE_SERVICE_ROLE_KEY` è usata **solo server-side** e non è mai esposta al client
- Tutte le operazioni di scrittura passano per API routes server-side in `app/api/`
- `userId` e `adminId` non transitano mai dal browser — vengono letti dalla sessione server-side

---

## Variabili d'ambiente

```bash
# .env.local (mai committare)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # pubblica, protetta da RLS
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # solo server-side
# RESEND_API_KEY=re_...                       # da aggiungere quando si implementa email
```

---

## Setup iniziale (nuovo ambiente)

1. Crea progetto su [supabase.com](https://supabase.com)
2. Esegui le migration in ordine su **SQL Editor**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_fix_month_status_rls.sql`
   - `supabase/migrations/003_fix_equity_scores.sql`
3. Crea il primo admin: **Authentication → Users → Add user**, poi inserisci riga in `users` con `ruolo = 'admin'`
4. Copia le chiavi API in `.env.local`
5. `npm install && npm run dev`

---

## Deploy (Vercel)

- Collega repo GitHub al progetto Vercel
- Framework Preset: **Next.js**
- Root Directory: vuoto (app è nella root del repo)
- Aggiungi le 3 variabili d'ambiente nel pannello Vercel
- Ogni push su `main` triggera il deploy automatico

---

## TODO

- [ ] Integrare **Resend** per invio email "mese confermato" (API key: `RESEND_API_KEY`)
- [ ] Export Excel su **template aziendale** (l'utente deve fornire il modello)
- [ ] Aggiungere festività per anni successivi al 2026
- [ ] Gestione festività da UI admin

---

## Algoritmo equità turni

```
score = turni_totali + (festivi × 2) + (festività_comandate × 3)
```

Chi ha **score più basso** ha priorità nell'assegnazione del prossimo turno.
La funzione RPC `get_equity_scores(p_month, p_year)` calcola lo score:
- `p_month = 0` → su tutti i tempi
- `p_month > 0` → solo per il mese specificato
