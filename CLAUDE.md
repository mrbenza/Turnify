# CLAUDE.md — Turnify

## Cos'è Turnify
Web app per la gestione dei turni di reperibilità dei dipendenti.
Permette ai dipendenti di segnare la propria disponibilità su un calendario,
e all'amministratore di assegnare i turni garantendo una rotazione equa,
con export Excel del mese confermato.

## Stack tecnico
| Layer | Tecnologia | Note |
|-------|-----------|------|
| Frontend | Next.js su Vercel | Free tier |
| Backend/API | Supabase | Free tier |
| Database | Supabase PostgreSQL | Free tier |
| Auth | Supabase Auth | Email + password |
| Export Excel | API route Next.js + libreria xlsx | Basato su template fornito dall'utente |

## Struttura cartelle
```
turnify/
├── CLAUDE.md                  ← questo file
├── SHEET_SCHEMA.md            ← schema DB Supabase
├── AGENTS.md                  ← ruoli e regole degli agenti
├── frontend/                  ← Next.js app (Vercel)
│   ├── app/
│   │   ├── login/
│   │   ├── user/              ← dashboard dipendente
│   │   └── admin/             ← dashboard admin
│   ├── components/
│   └── lib/
│       └── supabase.ts
└── backend/                   ← logica server (API routes Next.js o edge functions)
    ├── availability.ts
    ├── shifts.ts
    ├── stats.ts
    └── export.ts
```

## Agenti
Vedi `AGENTS.md` per i ruoli dettagliati.

| Agente | File di competenza |
|--------|-------------------|
| ORCHESTRATOR | coordina tutti |
| CODE AGENT | `backend/*.ts`, API routes, logica server |
| UI AGENT | `frontend/**/*.tsx`, componenti, pagine |
| TEST AGENT | `**/*.test.ts` |
| SCHEMA AGENT | `SHEET_SCHEMA.md`, tabelle Supabase |
| DOCS AGENT | `CLAUDE.md`, `AGENTS.md`, `SHEET_SCHEMA.md` |

## Regole generali
1. Ogni agente tocca SOLO i propri file.
2. Test Agent viene chiamato dopo ogni modifica prima di chiudere il task.
3. Docs Agent viene chiamato per ultimo.
4. Le statistiche NON si salvano nel DB — si calcolano sempre da query.
5. L'export Excel legge SEMPRE dal database, mai dallo stato UI.
6. Un mese LOCKED è immutabile — nessuna eccezione.

## Flusso operativo standard
```
Richiesta → ORCHESTRATOR
                 │
                 ├─► CODE AGENT  e/o  UI AGENT  e/o  SCHEMA AGENT
                 │
                 ├─► TEST AGENT   (sempre, dopo ogni modifica)
                 │
                 └─► DOCS AGENT   (sempre, per ultimo)
```

## Flusso business principale
```
Dipendente segna disponibilità (status: pending)
        ↓
Admin visualizza calendario globale
        ↓
Admin assegna turni (click su cella)
        ↓
Admin verifica statistiche equità
        ↓
Admin LOCK mese → tutto diventa immutabile
        ↓
Export Excel (da DB, su template utente)
```
