# Logica di Turnazione — Turnify

Questo documento descrive il funzionamento del sistema di assegnazione turni di reperibilità.

---

## Tipi di turno

| `shift_type` | Quando si applica |
|---|---|
| `weekend` | Sabato o domenica non festivi |
| `festivo` | Qualsiasi giorno presente in tabella `holidays` |
| `reperibilita` | Feriale non festivo (raro, uso futuro) |

---

## Regola fondamentale: max 1 turno speciale al mese

Un dipendente non può lavorare più di **un turno speciale** (weekend o festivo) per mese.
Un weekend conta come unità unica: sabato + domenica insieme.

```
Turni speciali = weekend (Sab+Dom) + festivi
Max per mese per dipendente = 1
```

---

## Flusso assegnazione turno (admin)

```mermaid
flowchart TD
    A([Admin clicca su un giorno]) --> B{Il giorno è\nweekend o festivo?}
    B -- No --> Z([Nessuna azione])
    B -- Sì --> C[Apre pannello laterale]

    C --> D[Carica lista utenti\ncon stato per quel giorno]

    D --> E1[Sezione: ASSEGNATI\nsfondo rosso]
    D --> E2[Sezione: DISPONIBILI\nsfondo verde/giallo/rosso]
    D --> E3[Sezione: GIÀ IN TURNO\nsfondo ambra]
    D --> E4[Sezione: NON DISPONIBILI\ncollassabile]

    E2 --> F[Admin sceglie utente\ne clicca Assegna]
    F --> G[Dialog di conferma]
    G -- Annulla --> C
    G -- Conferma --> H[POST /api/shifts]

    H --> I{Validazione\nAPI}
    I -- Utente già ha\nun turno speciale\nnel mese --> J([Errore 409\nMessaggio all'admin])
    I -- OK --> K[Inserisce turno in DB]
    K --> L[Aggiorna UI + ricalcola\nequity scores]
```

---

## Classificazione utenti nel pannello laterale

```mermaid
flowchart TD
    U([Utente]) --> A{Ha già un turno\nsu QUESTA data?}
    A -- Sì --> R1[ASSEGNATI 🔴]

    A -- No --> B{Ha disponibilità\nsu questa data?}
    B -- No --> R4[NON DISPONIBILI ⚫]

    B -- Sì --> C{Ha già un turno\nspeciale in un ALTRO\nweekend/festivo\ndi questo mese?}
    C -- Sì --> R3[GIÀ IN TURNO 🟡]

    C -- No --> R2[DISPONIBILI 🟢]
    R2 --> D[Calcolo badge raccomandazione]
```

---

## Calcolo badge raccomandazione (sezione Disponibili)

I badge indicano se un utente ha lavorato di recente. Sono sempre visibili, anche se nessuno è ancora stato assegnato al giorno.

```mermaid
flowchart TD
    U([Utente disponibile]) --> A{Ha lavorato\nil mese precedente?}
    A -- No --> B{Ha lavorato\nil weekend precedente\na questo?}
    B -- No --> G1["✓ ottimo\n(sfondo verde)"]
    B -- Sì --> G2["⚠ recente\n(sfondo giallo)"]
    A -- Sì --> C{Ha lavorato\nanche il weekend\nprecedente?}
    C -- No --> G2
    C -- Sì --> G3["✕ evita\n(sfondo rosso)"]
```

**Mese precedente**: turni nel mese prima di quello visualizzato.
**Weekend precedente**: il sabato/domenica immediatamente prima del weekend corrente (anche se a cavallo di mese).

---

## Utente Suggerito (★)

Il sistema indica automaticamente l'utente ottimale per ogni giorno.

```mermaid
flowchart TD
    A([Calcolo suggerito\nper una data]) --> B[Filtra candidati:\n- disponibile sul giorno\n- non già assegnato\n- non già in turno nel mese]

    B --> C{Esistono candidati\nche NON hanno lavorato\nil mese precedente?}

    C -- Sì --> D[Pool: solo chi\nnon ha lavorato\nil mese prec.]
    C -- No\ntutti hanno lavorato --> E[Pool: tutti i\ncandidati disponibili\ncome fallback]

    D --> F[Ordina per score\nequità annuale ↑]
    E --> F

    F --> G[★ Suggerito = primo\ndella lista]
```

### Score equità

```
score = turni_totali + (festivi × 2) + (fest_comandate × 3)
```

- Score basso → poca esperienza → alta priorità
- Calcolato su **tutti i turni dell'anno corrente** (mesi locked + aperti + assegnati non confermati)
- Si aggiorna in tempo reale dopo ogni assegnazione/rimozione

---

## Ordine di visualizzazione nella sezione Disponibili

```
1. ★ Suggerito       → score annuale più basso tra chi non ha lavorato il mese prec.
2. ✓ ottimo          → non ha lavorato né il mese scorso né il w.e. precedente
3. ⚠ recente         → ha lavorato il mese scorso O il w.e. precedente
4. ✕ evita           → ha lavorato sia il mese scorso che il w.e. precedente
```

---

## Flusso conferma mese (lock)

```mermaid
flowchart TD
    A([Admin clicca\nConferma mese]) --> B{Tutti i giorni\nweekend e festivi\nhanno almeno 1 turno?}

    B -- No --> C[Errore:\nlista giorni scoperti]
    B -- Sì --> D[POST /api/month\naction: lock]

    D --> E[month_status → locked]
    E --> F[Mese immutabile:\nnessuna aggiunta/rimozione\npossibile]
    F --> G[Export Excel disponibile]
```

**Un mese locked non può essere modificato.** Può essere sbloccato dall'admin tramite il pulsante Annulla conferma, che riporta lo stato a `open`.

---

## Domande frequenti

**La classifica aggiorna solo sui mesi confermati?**
No. `get_equity_scores` legge dalla tabella `shifts` senza filtrare su `month_status`. Ogni turno assegnato — anche in un mese non confermato — incide immediatamente sullo score e sui suggerimenti.

**Cosa succede se 1° maggio (festivo) è subito prima del weekend 2-3 maggio?**
Chi lavora il 1° maggio finisce nella sezione "Già in turno" per il weekend successivo, e non può essere riassegnato. La regola vale anche in direzione inversa.

**Il sistema può suggerire chi ha già lavorato il mese precedente?**
Solo come fallback, se tutti gli utenti disponibili hanno lavorato il mese precedente. In quel caso viene indicato il badge ⚠ o ✕ per avvisare l'admin.
