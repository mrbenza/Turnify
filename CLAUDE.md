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
| Export Excel | API route Next.js + JSZip | Template preservato intatto (logo, firma, CF); solo sheet1.xml modificato |

## Struttura cartelle
```
turnify/
├── CLAUDE.md                  ← questo file
├── README.md
├── docs/
│   ├── AGENTS.md              ← ruoli e regole degli agenti
│   └── SHEET_SCHEMA.md        ← schema DB Supabase
├── app/
│   ├── api/                   ← backend server-side
│   │   ├── shifts/
│   │   ├── availability/
│   │   ├── export/            ← genera XLSX su template (JSZip)
│   │   ├── month/
│   │   ├── email-settings/
│   │   └── users/
│   ├── admin/
│   ├── user/
│   └── login/
├── components/
├── lib/
│   ├── supabase/
│   └── utils/
└── supabase/
    └── migrations/
```

## Agenti
Vedi `docs/AGENTS.md` per i ruoli dettagliati.

| Agente | File di competenza |
|--------|-------------------|
| ORCHESTRATOR | coordina tutti |
| CODE AGENT | `app/api/**/*.ts`, `lib/utils/*.ts`, logica server |
| UI AGENT | `app/**/*.tsx`, `components/**/*.tsx`, pagine |
| TEST AGENT | `**/*.test.ts` |
| SCHEMA AGENT | `docs/SHEET_SCHEMA.md`, tabelle Supabase |
| DOCS AGENT | `CLAUDE.md`, `README.md`, `docs/AGENTS.md`, `docs/SHEET_SCHEMA.md` |

## Regole generali
1. Ogni agente tocca SOLO i propri file.
2. Test Agent viene chiamato dopo ogni modifica prima di chiudere il task.
3. Docs Agent viene chiamato per ultimo.
4. Le statistiche NON si salvano nel DB — si calcolano sempre da query.
5. L'export Excel legge SEMPRE dal database, mai dallo stato UI.
6. Un mese LOCKED è immutabile — nessuna eccezione.

## Convenzioni TypeScript (v1.1.0+)
- `lib/supabase/types.ts` usa `export type`, non `export interface` — richiesto da Supabase JS v2 per l'inferenza automatica dei tipi di ritorno delle query.
- **Zero `any`**: nessun `as any`, nessun `eslint-disable @typescript-eslint/no-explicit-any` nelle API route. Se TypeScript non inferisce il tipo corretto, il problema va risolto a monte (tipo mancante, struttura `Database` incompleta, o logica da correggere).
- **Zero cast ridondanti su query Supabase**: non usare `(data ?? []) as Tipo[]` se `types.ts` è aggiornato — il tipo viene inferito automaticamente.
- Usare `as const` per narroware status literals su union type (es. `{ status: 'locked' as const }`).
- Convertire `null` in `undefined` con `?? undefined` nelle prop React quando il tipo atteso è `T | undefined`.

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
