# SHEET_SCHEMA.md — Schema database Supabase (Turnify)

> Aggiornare questo file ad ogni modifica dello schema.
> Responsabilità: SCHEMA AGENT + DOCS AGENT.

---

## Tabella: `users`
Anagrafica utenti della piattaforma.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK, generato da Supabase Auth |
| nome | text | nome e cognome |
| email | text | unique, usata per il login |
| ruolo | text | `admin` \| `user` |
| attivo | boolean | default true — disattivare invece di cancellare |
| data_creazione | timestamptz | default now() |

**Indici:** `email` (unique)
**RLS:** solo admin può leggere tutti gli utenti; ogni utente legge solo se stesso.

---

## Tabella: `availability`
Disponibilità inserite dai dipendenti (Sab, Dom, Festivi).

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| date | date | giorno di disponibilità |
| available | boolean | true = disponibile |
| status | text | `pending` \| `approved` \| `locked` |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | aggiornato ad ogni modifica |

**Status:**
- `pending` → utente può ancora modificare
- `approved` → admin ha preso visione
- `locked` → mese confermato, immutabile

**Constraint:** unique su `(user_id, date)`
**RLS:** utente vede/modifica solo le proprie righe con status != locked; admin vede tutto.

---

## Tabella: `shifts`
Turni assegnati dall'admin. Separata da `availability` per design.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| date | date | giorno del turno |
| user_id | uuid | FK → users.id |
| shift_type | text | `weekend` \| `festivo` \| `reperibilita` |
| created_by | uuid | FK → users.id (admin che ha assegnato) |
| created_at | timestamptz | default now() |

**Constraint:** unique su `(date, user_id)`
**RLS:** utente legge solo i propri turni; admin legge e scrive tutto.

---

## Tabella: `holidays`
Elenco festività, aggiornabile dall'admin.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| date | date | data della festività |
| name | text | es. "Natale", "Pasqua" |
| mandatory | boolean | true = festività comandata da distribuire equamente |
| year | integer | anno di riferimento |

**Constraint:** unique su `(date)`
**RLS:** tutti possono leggere; solo admin può scrivere.

---

## Tabella: `month_status`
Controlla lo stato e il lock di ogni mese.

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| month | integer | 1–12 |
| year | integer | es. 2026 |
| status | text | `open` \| `approved` \| `locked` |
| locked_by | uuid | FK → users.id (admin che ha bloccato) |
| locked_at | timestamptz | quando è stato bloccato |

**Status:**
- `open` → mese in lavorazione, disponibilità modificabili
- `approved` → admin ha verificato, in attesa di lock formale
- `locked` → confermato definitivamente, export disponibile

**Constraint:** unique su `(month, year)`
**RLS:** solo admin può scrivere; tutti possono leggere.

---

## Query statistiche (reference per CODE AGENT)

```sql
-- Turni totali per persona (mese corrente)
SELECT u.nome, COUNT(*) as turni
FROM shifts s
JOIN users u ON s.user_id = u.id
WHERE date_trunc('month', s.date) = date_trunc('month', now())
GROUP BY u.nome
ORDER BY turni DESC;

-- Festivi lavorati per persona
SELECT u.nome, COUNT(*) as festivi
FROM shifts s
JOIN users u ON s.user_id = u.id
JOIN holidays h ON s.date = h.date
GROUP BY u.nome
ORDER BY festivi DESC;

-- Festività comandate per persona
SELECT u.nome, COUNT(*) as fest_comandate
FROM shifts s
JOIN users u ON s.user_id = u.id
JOIN holidays h ON s.date = h.date
WHERE h.mandatory = true
GROUP BY u.nome;

-- Score equità (per suggerimento assegnazione)
SELECT
  u.id,
  u.nome,
  COUNT(s.id) as turni_totali,
  SUM(CASE WHEN h.date IS NOT NULL THEN 1 ELSE 0 END) as festivi,
  SUM(CASE WHEN h.mandatory THEN 1 ELSE 0 END) as fest_comandate,
  COUNT(s.id) + (SUM(CASE WHEN h.date IS NOT NULL THEN 1 ELSE 0 END) * 2)
             + (SUM(CASE WHEN h.mandatory THEN 1 ELSE 0 END) * 3) as score
FROM users u
LEFT JOIN shifts s ON u.id = s.user_id
LEFT JOIN holidays h ON s.date = h.date
WHERE u.ruolo = 'user' AND u.attivo = true
GROUP BY u.id, u.nome
ORDER BY score ASC;  -- score basso = priorità alta
```

---

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

**RLS:** tutti leggono; solo admin scrive.

---

## Colonne aggiuntive su `month_status`
Aggiunte con migration 002:

| Colonna | Tipo | Note |
|---------|------|------|
| email_inviata | boolean | default false — true dopo invio notifica |
| email_inviata_at | timestamptz | nullable — timestamp invio |

> Quando `email_inviata = true` il rollback del mese non è più possibile.

---

## Funzione RPC: `get_equity_scores`
Calcola lo score di equità per ogni dipendente attivo.

**Firma:** `get_equity_scores(p_month integer, p_year integer)`
- `p_month = 0` → score su tutti i tempi
- `p_month > 0` → score filtrato per mese/anno specificato

**Formula score:** `turni_totali + (festivi × 2) + (fest_comandate × 3)`
Score più basso = priorità più alta nel prossimo turno.

---

## Changelog schema

| Data | Modifica | File migration |
|------|---------|----------------|
| 2026-03-16 | Schema iniziale | 001_initial_schema.sql |
| 2026-03-16 | Fix RLS month_status (policy INSERT separata) | 002_fix_month_status_rls.sql |
| 2026-03-16 | Fix get_equity_scores (filtro mese), aggiunta email_settings e colonne month_status | 003_fix_equity_scores.sql |
