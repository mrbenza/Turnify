# AGENTS.md — Ruoli e regole degli agenti Turnify

## Panoramica
Turnify usa un sistema multi-agente. Ogni agente ha un dominio preciso.
L'Orchestrator coordina il flusso senza toccare file direttamente.

---

## ORCHESTRATOR
**Ruolo:** punto di ingresso per ogni richiesta.

**Responsabilita:**
- Analizzare la natura della richiesta
- Decidere quali agenti coinvolgere e in quale ordine
- Garantire che Test Agent e Docs Agent vengano sempre chiamati
- Gestire i conflitti tra agenti (es. CODE vuole modificare lo schema → prima chiama SCHEMA AGENT)

**Non tocca mai file direttamente.**

---

## CODE AGENT
**File di competenza:**
- `app/api/**/*.ts` — API routes server-side Next.js
- `lib/utils/*.ts` — utility condivise (date, calcoli, helpers)
- `lib/supabase/server.ts` — client Supabase server-side

**Responsabilita:**
- Logica server-side (availability, shifts, stats, export, import storico)
- Query Supabase
- Algoritmo di equita turni
- Generazione Excel da template (JSZip)
- Importazione storico da XLSX

**Regole:**
- NON modifica file `.tsx` o `.css` — quelli sono UI AGENT
- Prima di modificare lo schema DB, si coordina con SCHEMA AGENT tramite Orchestrator
- Le statistiche si calcolano sempre da query, mai da dati salvati

**Algoritmo equita (riferimento — migration 010):**
```
score = turni_totali + (festivi_attivi x 2)

Dove festivi_attivi = turni su giorni con holidays.mandatory = true
Ogni turno su festivita attiva vale 3 pt totali (1 base + 2 extra)
Priorita → score piu basso

Funzione RPC: get_equity_scores(p_month integer, p_year integer)
  p_month = 0 → tutti i tempi
  p_month > 0 → filtrato per mese/anno
```

**Suggerimento assegnazione:**
- Ordinato per `turni_totali` grezzo + `sessionCounts` (delta sessione in memoria)
- Cross-month Saturday: chi ha lavorato il sabato del mese precedente ha priorita sul primo sabato del mese nuovo
- Same-month Sab+Dom: la domenica suggerisce chi ha lavorato il sabato della stessa settimana

---

## UI AGENT
**File di competenza:**
- `app/**/*.tsx` — pagine Next.js (login, user, admin/*)
- `components/**/*.tsx` — componenti riutilizzabili
- `app/globals.css` — stili globali

**Responsabilita:**
- Pagina login (`/login`)
- Dashboard dipendente (`/user`): calendario disponibilita + storico turni
- Dashboard manager (`/admin`): card mese corrente/prossimo con stato colorato, turni collapsibili
- Dashboard admin (`/admin`): contatori utenti, stato template, accesso rapido
- Calendario globale (`/admin/disponibilita`): griglia dipendenti × giorni, pannello laterale assegnazione
- Lista turni (`/admin/turni`): weekend Sab+Dom raggruppati in riga unica
- Statistiche equita (`/admin/statistiche`): grafico score per dipendente
- Invio turni (`/admin/export`): anteprima grafica + genera Excel
- Gestione utenti (`/admin/utenti`): prop `isManager` per nascondere modifica ruolo
- Sistema (`/admin/sistema`, admin only): upload template, import storico, calendario festivita con anni collassabili e toggle Attiva/Non attiva
- Impostazioni (`/admin/impostazioni`): gestione email notifiche
- Navbar: sidebar desktop + bottom bar mobile; voci diverse per admin vs manager
- Responsive/mobile
- Gestione stati colore calendario:
  - bianco = non disponibile
  - verde = disponibile
  - giallo = pending (in attesa manager)
  - rosso = turno assegnato

**Regole:**
- NON contiene logica business — chiama sempre le API del backend
- L'export Excel si triggera da UI ma il file viene generato dal backend
- I dati mostrati nelle statistiche vengono dall'API, non calcolati nel frontend
- Il ruolo utente viene letto dalla sessione server-side, mai passato dal browser

---

## TEST AGENT
**File di competenza:**
- `**/*.test.ts`
- `**/*.spec.ts`

**Responsabilita:**
- Scrivere test per ogni modifica di CODE AGENT e UI AGENT
- Eseguire i test dopo ogni modifica
- Riportare i risultati all'Orchestrator prima di chiudere il task

**Viene chiamato SEMPRE prima di considerare una modifica completata.**

---

## SCHEMA AGENT
**File di competenza:**
- `docs/SHEET_SCHEMA.md`
- Struttura tabelle Supabase (documentata in `docs/SHEET_SCHEMA.md`)
- File in `supabase/migrations/`

**Responsabilita:**
- Aggiunta/modifica colonne e tabelle
- Scrittura file migration
- Mantenimento coerenza tra schema DB e codice backend
- Documentazione di ogni cambio schema

**Regole:**
- Ogni modifica allo schema deve essere documentata in `docs/SHEET_SCHEMA.md` e aggiunta al changelog
- Se una modifica schema rompe query esistenti, avvisa CODE AGENT prima di procedere

---

## DOCS AGENT
**File di competenza:**
- `CLAUDE.md`
- `README.md`
- `docs/AGENTS.md`
- `docs/SHEET_SCHEMA.md`
- `docs/LOGICA_TURNI.md`
- `docs/TODO.md`

**Responsabilita:**
- Aggiornare la documentazione dopo ogni modifica rilevante
- Mantenere `docs/SHEET_SCHEMA.md` allineato con le modifiche di SCHEMA AGENT
- Aggiornare `CLAUDE.md` con nuove convenzioni emerse durante lo sviluppo
- Mantenere `README.md` aggiornato con la struttura attuale del progetto
- Aggiornare `docs/LOGICA_TURNI.md` dopo modifiche all'algoritmo equita o al flusso operativo
- Aggiornare `docs/TODO.md` dopo ogni funzionalita completata o aggiunta

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
| Modifica all'algoritmo equita | CODE AGENT aggiorna logica, SCHEMA AGENT aggiorna funzione RPC, DOCS AGENT aggiorna LOGICA_TURNI.md e SHEET_SCHEMA.md |
