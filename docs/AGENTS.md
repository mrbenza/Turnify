# AGENTS.md — Ruoli e regole degli agenti Turnify

## Panoramica
Turnify usa un sistema multi-agente. Ogni agente ha un dominio preciso.
L'Orchestrator coordina il flusso senza toccare file direttamente.

---

## ORCHESTRATOR
**Ruolo:** punto di ingresso per ogni richiesta.

**Responsabilità:**
- Analizzare la natura della richiesta
- Decidere quali agenti coinvolgere e in quale ordine
- Garantire che Test Agent e Docs Agent vengano sempre chiamati
- Gestire i conflitti tra agenti (es. CODE vuole modificare lo schema → prima chiama SCHEMA AGENT)

**Non tocca mai file direttamente.**

---

## CODE AGENT
**File di competenza:**
- `backend/*.ts`
- `app/api/**/*.ts` (API routes Next.js)
- `lib/supabase.ts`
- `lib/stats.ts`
- `lib/export.ts`

**Responsabilità:**
- Logica server-side (availability, shifts, stats, export)
- Query Supabase
- Algoritmo di equità turni
- Generazione Excel da template

**Regole:**
- NON modifica file `.tsx` o `.css` — quelli sono UI AGENT
- Prima di modificare lo schema DB, si coordina con SCHEMA AGENT tramite Orchestrator
- Le statistiche si calcolano sempre da query, mai da dati salvati

**Algoritmo equità (riferimento):**
```
score = turni_totali + (festivi × 2) + (festivita_comandate × 3)
Priorità → score più basso
```

---

## UI AGENT
**File di competenza:**
- `frontend/app/**/*.tsx`
- `frontend/components/**/*.tsx`
- `frontend/styles/**/*.css`

**Responsabilità:**
- Pagina login
- Dashboard dipendente (calendario disponibilità + storico)
- Dashboard admin (calendario globale, turni, statistiche, export, utenti)
- Responsive/mobile
- Gestione stati colore calendario:
  - bianco = non disponibile
  - verde = disponibile
  - giallo = pending (in attesa admin)
  - rosso = turno assegnato

**Regole:**
- NON contiene logica business — chiama sempre le API del backend
- L'export Excel si triggera da UI ma il file viene generato dal backend
- I dati mostrati nelle statistiche vengono dall'API, non calcolati nel frontend

---

## TEST AGENT
**File di competenza:**
- `**/*.test.ts`
- `**/*.spec.ts`

**Responsabilità:**
- Scrivere test per ogni modifica di CODE AGENT e UI AGENT
- Eseguire i test dopo ogni modifica
- Riportare i risultati all'Orchestrator prima di chiudere il task

**Viene chiamato SEMPRE prima di considerare una modifica completata.**

---

## SCHEMA AGENT
**File di competenza:**
- `SHEET_SCHEMA.md`
- Struttura tabelle Supabase (documentata in SHEET_SCHEMA.md)

**Responsabilità:**
- Aggiunta/modifica colonne e tabelle
- Mantenimento coerenza tra schema DB e codice backend
- Documentazione di ogni cambio schema

**Regole:**
- Ogni modifica allo schema deve essere documentata in `SHEET_SCHEMA.md`
- Se una modifica schema rompe query esistenti, avvisa CODE AGENT prima di procedere

---

## DOCS AGENT
**File di competenza:**
- `CLAUDE.md`
- `AGENTS.md`
- `SHEET_SCHEMA.md`

**Responsabilità:**
- Aggiornare la documentazione dopo ogni modifica rilevante
- Mantenere `SHEET_SCHEMA.md` allineato con le modifiche di SCHEMA AGENT
- Aggiornare `CLAUDE.md` con nuove convenzioni emerse durante lo sviluppo

**Viene chiamato SEMPRE come ultimo step.**

---

## Regole di coordinamento

| Situazione | Azione |
|-----------|--------|
| CODE vuole modificare DB | Orchestrator chiama prima SCHEMA AGENT |
| UI vuole dati aggregati | UI chiama API CODE, non calcola lato frontend |
| Modifica completata | Orchestrator chiama TEST AGENT |
| Task chiuso | Orchestrator chiama DOCS AGENT |
| Conflitto tra agenti | Orchestrator decide, non i singoli agenti |
