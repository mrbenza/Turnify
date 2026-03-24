# SHEET_SCHEMA.md — Schema database Supabase (Turnify)

> Aggiornare questo file ad ogni modifica dello schema.
> Responsabilita: SCHEMA AGENT + DOCS AGENT.

---

## Tabella: `users`
Anagrafica utenti della piattaforma.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK, generato da Supabase Auth |
| nome | text | nome e cognome |
| email | text | unique, usata per il login |
| ruolo | text | `admin` \| `manager` \| `dipendente` (constraint aggiornato in migration 009) |
| attivo | boolean | default true — disattivare invece di cancellare |
| data_creazione | timestamptz | default now() |
| area_id | uuid | FK → areas.id ON DELETE RESTRICT (migration 013) |

**Indici:** `email` (unique), `area_id`
**RLS:**
- `admin` puo leggere tutti gli utenti tranne altri admin; puo scrivere su tutti i ruoli
- `manager` legge solo utenti con `ruolo = 'dipendente'` o se stesso
- `dipendente` legge solo se stesso
- Funzione `is_admin_or_manager()` usata nelle policy per operazioni condivise

---

## Tabella: `availability`
Disponibilita inserite dai dipendenti (sabato, domenica, festivi attivi).

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| date | date | giorno di disponibilita |
| available | boolean | true = disponibile |
| status | text | `pending` \| `approved` \| `locked` |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | aggiornato ad ogni modifica |
| area_id | uuid | FK → areas.id ON DELETE RESTRICT (migration 013) |

**Status:**
- `pending` → dipendente puo ancora modificare
- `approved` → manager ha preso visione (impostato dopo export Excel)
- `locked` → mese confermato, immutabile

**Constraint:** unique su `(user_id, date)`
**RLS:** dipendente vede/modifica solo le proprie righe con `status != locked`; admin e manager vedono tutto.

---

## Tabella: `shifts`
Turni assegnati dal manager. Separata da `availability` per design.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| date | date | giorno del turno |
| user_id | uuid | FK → users.id |
| shift_type | text | `weekend` \| `festivo` \| `reperibilita` |
| reperibile_order | smallint | `1` = 1° reperibile (colonna D Excel) \| `2` = 2° reperibile (colonna E Excel); default 1 |
| created_by | uuid | FK → users.id (manager che ha assegnato) |
| created_at | timestamptz | default now() |
| area_id | uuid | FK → areas.id ON DELETE RESTRICT (migration 013) |

**Valori shift_type:**
- `weekend` — sabato o domenica non festivi
- `festivo` — giorno presente in `holidays` con `mandatory = true` (festivita attiva). Le festivita con `mandatory = false` sono ignorate e trattate come giorni normali.
- `reperibilita` — feriale non festivo (raro, uso futuro)

**Constraint:** unique su `(date, user_id)`
**RLS:** dipendente legge solo i propri turni; admin e manager leggono e scrivono tutto.

---

## Tabella: `holidays`
Elenco festivita, aggiornabile dall'admin.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| date | date | data della festivita |
| name | text | es. "Natale", "Pasqua" |
| mandatory | boolean | semantica aggiornata — vedi sotto |
| year | integer | anno di riferimento (colonna computed, aggiunta in migration 004) |

**Semantica `mandatory` (aggiornata in migration 010):**
- `true` = festivita **attiva**: visibile sul calendario come giorno speciale (arancione), assegnabile come turno di tipo `festivo`, vale 3 pt nello score equita (1 base + 2 extra)
- `false` = festivita **non attiva**: ignorata completamente — trattata come giorno normale, non appare sul calendario come festivo, non incide sullo score

**UI:** il toggle e etichettato "Attiva" / "Non attiva" (non piu "Comandata")

**Constraint:** unique su `(date)`
**RLS:** tutti possono leggere; solo admin puo scrivere.

---

## Tabella: `month_status`
Controlla lo stato e il lock di ogni mese.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| month | integer | 1–12 |
| year | integer | es. 2026 |
| status | text | `open` \| `locked` \| `confirmed` |
| locked_by | uuid | FK → users.id (manager che ha bloccato) |
| locked_at | timestamptz | quando e stato bloccato |
| email_inviata | boolean | default false — true dopo invio notifica |
| email_inviata_at | timestamptz | nullable — timestamp invio |
| area_id | uuid | FK → areas.id ON DELETE RESTRICT (migration 013) |

**Status:**
- `open` → mese in lavorazione, disponibilita modificabili
- `locked` → confermato dal manager, pronto per export Excel, disponibilita immutabili
- `confirmed` → Excel generato/scaricato; impostato automaticamente dall'API `/api/export` al momento del download

**Constraint:** unique su `(month, year, area_id)` — ogni area ha il proprio stato mensile
**RLS:** admin e manager possono scrivere; tutti possono leggere.

---

## Tabella: `areas`
Aree aziendali con logica di turnazione propria (migration 011). Multi-area non ancora implementato nel frontend.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| nome | text | unique, es. "Default" |
| scheduling_mode | text | `weekend_full` \| `single_day` \| `sun_next_sat` |
| workers_per_day | integer | `1` o `2` — numero di reperibili per giorno; default 2 |
| template_path | text | nullable — nome file template Excel nello storage |
| manager_id | uuid | FK → users.id — manager responsabile dell'area |
| created_at | timestamptz | default now() |

**scheduling_mode:**
- `weekend_full` — Sab e Dom assegnati con conferma (propone il giorno abbinato)
- `single_day` — Sab e Dom indipendenti, nessun pairing
- `sun_next_sat` — Dom assegnata propone il Sab+7 della settimana successiva

**Nota:** riga "Default" inserita automaticamente alla prima configurazione tramite API `/api/config`.
Tutti i record esistenti in `users`, `shifts`, `availability`, `month_status` sono stati assegnati all'area Default con migration 013.

---

## Tabella: `email_settings`
Indirizzi email aggiuntivi che ricevono la notifica "mese confermato".

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| email | text | unique |
| descrizione | text | nullable, es. "Lista distribuzione" |
| attivo | boolean | default true |
| created_at | timestamptz | default now() |

**RLS:** admin e manager leggono; solo admin e manager scrivono.

---

## Funzione RPC: `get_equity_scores`
Calcola lo score di equita per ogni dipendente attivo.

**Firma:** `get_equity_scores(p_month integer, p_year integer)`
- `p_month = 0` → score su tutti i tempi
- `p_month > 0` → score filtrato per mese/anno specificato

**Formula score (migration 010):**
```
score = turni_totali + (festivi_attivi x 2)
```
- Ogni turno normale vale 1 pt
- Ogni turno su festivita con `mandatory = true` vale 3 pt (1 base + 2 extra dal moltiplicatore)
- Score piu basso = priorita piu alta nel prossimo turno

**Campi restituiti per ogni dipendente:**
- `id`, `nome`
- `turni_totali` — conteggio grezzo di tutti i turni
- `festivi_attivi` — turni su giorni con `holidays.mandatory = true`
- `score` — formula sopra

**Nota:** la funzione filtra su `ruolo = 'dipendente'` e `attivo = true`.

---

## Query di riferimento (CODE AGENT)

```sql
-- Turni totali per persona (mese corrente)
SELECT u.nome, COUNT(*) as turni
FROM shifts s
JOIN users u ON s.user_id = u.id
WHERE date_trunc('month', s.date) = date_trunc('month', now())
GROUP BY u.nome
ORDER BY turni DESC;

-- Score equita (formula aggiornata migration 010)
SELECT
  u.id,
  u.nome,
  COUNT(s.id) as turni_totali,
  SUM(CASE WHEN h.mandatory = true THEN 1 ELSE 0 END) as festivi_attivi,
  COUNT(s.id) + (SUM(CASE WHEN h.mandatory = true THEN 1 ELSE 0 END) * 2) as score
FROM users u
LEFT JOIN shifts s ON u.id = s.user_id
LEFT JOIN holidays h ON s.date = h.date
WHERE u.ruolo = 'dipendente' AND u.attivo = true
GROUP BY u.id, u.nome
ORDER BY score ASC;  -- score basso = priorita alta
```

---

## Changelog schema

| Data | Modifica | File migration |
|------|---------|----------------|
| 2026-03-16 | Schema iniziale, RLS, festivita 2026 | 001_initial_schema.sql |
| 2026-03-16 | Fix RLS month_status (policy INSERT separata) | 002_fix_month_status_rls.sql |
| 2026-03-16 | Fix get_equity_scores filtro mese, aggiunta email_settings, colonne month_status | 003_fix_equity_scores.sql |
| 2026-03-17 | Colonna year su holidays (computed) | 004_holidays_year_column.sql |
| 2026-03-18 | Status 'confirmed' su month_status | 005_month_status_confirmed.sql |
| 2026-03-18 | Ruolo manager: RLS is_admin_or_manager() | 006_manager_role_rls.sql |
| 2026-03-20 | Score equita pesi ridotti (normale×1, festivo×2, cmd×3) | 007_equity_scores_lower_weights.sql |
| 2026-03-20 | Fix ruolo 'user' → 'dipendente' nella funzione SQL | 008_equity_scores_fix_role.sql |
| 2026-03-20 | Fix constraint users.ruolo (admin\|manager\|dipendente) | 009_fix_users_role_constraint.sql |
| 2026-03-22 | Semplifica score: rimuove fest_comandate, solo festivi_attivi×2 | 010_simplify_equity_scores.sql |
| 2026-03-24 | Tabella `areas`: scheduling_mode, workers_per_day, template_path, manager_id | 011_areas.sql |
| 2026-03-24 | `shifts.reperibile_order`: 1=colonna D (1° rep.), 2=colonna E (2° rep.) | 012_reperibile_order.sql |
| 2026-03-24 | Multi-area: `area_id` su users/shifts/availability/month_status; unique (month,year,area_id) | 013_multi_area.sql |
