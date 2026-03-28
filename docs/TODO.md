# TODO — Turnify

Funzionalita da implementare in ordine di priorita.

---

## Alta priorita

*(Nessun item — tutto completato)*

---

## Bug noti (non bloccanti)

### Utenti admin con area_id valorizzato
- **Sintomo**: alcuni account admin (es. `admin3@turnify.test`) hanno `area_id` non null nel DB, mentre per design gli admin non devono avere area assegnata (scope globale).
- **Impatto**: nessuno — il codice ignora `profile.area_id` per gli admin. Non causa errori né comportamenti scorretti.
- **Fix**: azzerare manualmente `area_id = NULL` per tutti gli admin con area assegnata.
- **SQL**: `UPDATE public.users SET area_id = NULL WHERE ruolo = 'admin' AND area_id IS NOT NULL;`

---

## Media priorita

### Multi-area con scheduling modes diversi
- **Obiettivo**: supportare piu aree aziendali, ognuna con la propria logica di turnazione e i propri dipendenti
- **Stato attuale (2026-03-25)**: implementazione multi-area avanzata. `area_id` su tutte le tabelle principali (migration 013). UI selettore area su `/admin/disponibilita`. Email settings isolate per area. 14 aree seed con dati demo realistici.
- **Scheduling modes previsti**:
  | Mode | Comportamento |
  |------|--------------|
  | `weekend_full` | Sab+Dom con conferma: assegni uno, il sistema propone l'altro |
  | `single_day` | Sab e Dom indipendenti, assegnabili a persone diverse |
  | `sun_next_sat` | Chi lavora Dom lavora anche il Sab della settimana successiva |
- **Completato**:
  1. `area_id` su `users`, `availability`, `shifts`, `month_status` (migration 013)
  2. Seed 14 aree (Area1-Area14, regioni italiane), 1 manager + 8-18 dipendenti per area, 15.780 disponibilità per weekend 2026
  3. API email_settings: POST include `area_id` nel profilo e nell'insert; PATCH/DELETE filtrano per `area_id`
  4. UI `/admin/disponibilita`: accetta `searchParams`, selettore area via `<AreaSelector>` (dropdown)
  5. `components/admin/disponibilita/AreaSelector.tsx`: nuovo componente `<select>` client-side per navigare tra aree
  6. `components/admin/utenti/ListaUtenti.tsx`: filtro area pill → `<select>` dropdown
  7. Dashboard admin: badge "Aree" (verde) accanto ad Area Manager e ATC
- **Completato (2026-03-25)**:
  8. Gestione aree UI: dropdown manager in modal Modifica area mostra `Nome — NomeArea` se manager già assegnato, banner ambra se si seleziona manager già occupato
  9. API PATCH `/api/areas/[id]`: trasferimento manager in cascata (azzera `manager_id` dell'area precedente, aggiorna `users.area_id` del nuovo manager)
  10. Pagina `/admin/equita` (solo admin): panoramica equità cross-area con badge salute (verde/giallo/rosso), ranking espandibile per area, filtro mese/anno con toggle "Questo mese / Tutti i tempi"
  11. API `/api/equity-overview`: aggrega `get_equity_scores` in parallelo per tutte le aree, ritorna array `AreaEquitySummary`
  12. NavbarAdmin: voce "Equità" aggiunta per admin (tra Aree e Sistema)
  13. Export Excel area-aware: `generateTurniExcel` scrive nome area in A1 e cognome manager in B51 letti da DB tramite `areaId` (rimossi valori hardcoded)
  14. Seed DB fix: Area2-Liguria con `manager_id` impostato (Marco Ferrari); nomi utenti resi unici con suffisso numerico
- **Completato (2026-03-26)**:
  15. `import-shifts/route.ts`: area matching a 3 livelli (esatto → prefisso ilike → normalizzato)
  16. `import-shifts/resolve/route.ts`: fix `area_id` letto dal body della request (non da `profile.area_id` dell'admin)
  17. `users/route.ts`: accetta `area_id` opzionale nel body; se caller e admin, usa quello del body
  18. `users/[id]/route.ts`: cambio ruolo → manager aggiorna `areas.manager_id`; cambio da manager rimuove `areas.manager_id`
  19. `generateTurniExcel.ts`: nome file area-aware (`Area4_Marzo_2026.xlsx`); A1 parte corta uppercase; team leader in C51 (non B51)
  20. `CalendarioGlobale.tsx`: navigazione mesi filtra `month_status` per `area_id`
  21. `lib/utils/sort.ts`: nuovo file con `sortByNome` (Intl.Collator numeric)
  22. `ListaUtenti.tsx`: campo "Cerca per nome"
  23. `app/user/page.tsx`: nome area mostrato nel saluto dashboard dipendente
  24. `NavbarAdmin.tsx`: fix warning import pkg.version
  25. Template Excel: rinominato `AREA4.xlsx` → `template_turni.xlsx`; celle A1/C51 svuotate per universalita
- **Ancora da fare**: *(nessun item aperto)*
- **Comportamento `sun_next_sat` chiarito**: se il Sab successivo e gia occupato il manager riceve un avviso (non un blocco) e decide autonomamente.

### ✅ Bug pairing Dom↔Sab — NESSUNA MODIFICA NECESSARIA (pairing con conferma già implementato 2026-03-24)

---

### ✅ Import storico — 2° reperibile — NESSUNA MODIFICA NECESSARIA
- Colonna D = 1° reperibile (sempre presente), colonna E = 2° reperibile (presente solo se il manager ha assegnato 2 persone)
- Se E è presente, entrambi hanno effettivamente lavorato → entrambi contribuiscono allo score equità
- Il codice attuale importa già correttamente sia D che E come turni regolari (loop su `D${row}` + `E${row}`)
- Il file Excel è sempre lo specchio fedele della logica dei turni: non può esistere un E senza che quella persona abbia lavorato

---

## Bug noti / Debito tecnico

### Refactoring / Infrastruttura (da fare, non urgente)

1. **Centralizzare auth/ruolo/area_id in helper server-side** — Creare helper riutilizzabili (`requireUser`, `requireAdminOrManager`, `requireArea`) per evitare duplicazione del blocco auth+profile in ogni route.

2. **Ridurre uso del service-role dove non necessario** — Documentare e giustificare ogni `createServiceClient()` nel codebase. Sostituire con il client normale + RLS dove è sufficiente.

3. ✅ **Introdurre test per casi business critici** — 21 test Vitest su lock, immutabilità, isolamento area, privilege escalation. `npm test` < 300ms. (2026-03-29)

4. **Strato unico di validazione input** — Unificare la validazione dei parametri delle route critiche (date, mese/anno, tipi enumerati) in utility condivise per ridurre duplicazioni e rischio di discrepanze.

5. **Aggiornare README e docs post-security-hardening** — Allineare la documentazione al comportamento reale dopo le correzioni di immutabilità (locked/confirmed), validazione copertura al lock, e hardening RLS area-aware.

---

### `GraficoEquita.tsx` — `fetchScores` non in dep array di useEffect
- **File**: `components/admin/statistiche/GraficoEquita.tsx`
- **Problema**: `fetchScores` è definita dentro il componente e usata nell'`useEffect`, ma non inserita nel dep array per evitare loop infiniti. La regola `react-hooks/exhaustive-deps` è soppressa con `eslint-disable`.
- **Fix corretto**: wrappare `fetchScores` in `useCallback` con i suoi parametri come dipendenze, poi inserirla nel dep array dell'effect.
- **Impatto attuale**: nessuno funzionale — il comportamento è corretto. Solo debito tecnico.

---

## Bassa priorita

### ✅ Rotazione festivi comandati — COMPLETATO (2026-03-24)
Nel drawer di assegnazione, sotto il nome di ogni utente appare la nota "lavorato Pasqua '25" (o più anni) se ha già lavorato quel festivo in anni precedenti. Il manager decide autonomamente. Score non modificato.

---

### ✅ Bug pairing Dom↔Sab con festività in mezzo (sun_next_sat) — RISOLTO (2026-03-26)
- `getPairedDate` in `CalendarioGlobale.tsx`: blocco `sun_next_sat` ora precede il blocco `holiday`; domenica festiva (es. Pasqua) usa correttamente `d + 6` per trovare il sabato successivo (non `d + 7` come in precedenza)
- `app/api/shifts/route.ts`: rimossa condizione `isHolidayOnWeekend` che forzava `weekend_full` anche in `sun_next_sat`; validazione conflitti corretta: Dom usa `day + 6`, Sab usa `day - 6`
- `handleRemove` in `CalendarioGlobale.tsx`: rimuove solo il turno del giorno cliccato (nessun pairing inverso — comportamento voluto)
- DB Area4 aprile 2026: eliminato Sab 4 apr (orfano, domenica accoppiata in marzo), aggiunto Sab 2 mag (coppia Dom 26 apr). Coppie corrette: (Dom 5, Sab 11), (Dom 12, Sab 18), (Dom 19, Sab 25), (Dom 26, Sab 2 mag)

---

## Completato

- **[2026-03-26] Security hardening — API cross-area + RLS area-aware (migration 016)** — `DELETE /api/shifts/[id]`: query filtrata per `area_id` per i manager (admin: accesso totale). `POST /api/shifts`: verifica che `user_id` appartenga all'area del manager — 403 se cross-area. `GET /api/users/[id]/shifts`: storico visibile al manager solo per utenti della propria area — 403 se cross-area. `supabase/migrations/016_rls_area_aware.sql`: nuove funzioni `current_user_area_id()` e `is_manager()`; policy RLS riscritte per shifts, availability, month_status, users, email_settings con separazione admin/manager per area. `supabase/schema_completo.sql`: aggiornato a migrations 001–016.
- **[2026-03-26] Fix sun_next_sat: distanza Dom→Sab corretta (±6)** — `CalendarioGlobale.tsx` `getPairedDate`: blocco `sun_next_sat` precede `holiday`, distanza corretta `d+6`. `app/api/shifts/route.ts`: rimossa `isHolidayOnWeekend` che forzava `weekend_full` in `sun_next_sat`. Rimozione turno: `handleRemove` agisce solo sul giorno cliccato (no pairing inverso). DB: disponibilità Area4 aprile 2026 allineate alle coppie corrette.
- **[2026-03-26] Multi-area completamento** — `import-shifts/route.ts`: area matching a 3 livelli (esatto → ilike → normalizzato). `import-shifts/resolve/route.ts`: `area_id` dal body (fix area Default). `users/route.ts`: `area_id` opzionale nel body. `users/[id]/route.ts`: cambio ruolo sincronizza `areas.manager_id`. `generateTurniExcel.ts`: nome file `Area4_Marzo_2026.xlsx`, A1 uppercase parte corta, team leader C51. `CalendarioGlobale.tsx`: navigazione mesi filtrata per area. `lib/utils/sort.ts`: `sortByNome` con Intl.Collator numeric. `ListaUtenti.tsx`: ricerca per nome. `app/user/page.tsx`: nome area nel saluto. `NavbarAdmin.tsx`: fix import pkg.version. Template rinominato `template_turni.xlsx` con A1/C51 universali.
- **[2026-03-25] Import storico area-aware** — `app/api/import-shifts/route.ts`: lettura nome area da cella A1 e cognome manager da B51. Match area per nome (ilike) con cross-check manager; fallback automatico per cognome manager se il nome area non viene riconosciuto. Filtro dipendenti per `area_id` durante la costruzione del `cognomeMap`. `area_id` incluso in ogni record inserito in `shifts`. `month_status` aggiornato per `(month, year, area_id)`. Fix bug cascata in `PATCH /api/areas/[id]`: aggiornamento area ora precede gli effetti collaterali sul manager, eliminando lo stato inconsistente in caso di errore sul nome duplicato.
- **[2026-03-25] Multi-area — gestione aree UI, equità cross-area, export area-aware, fix seed** — `GestioneAree.tsx`: dropdown manager con etichetta area e banner ambra. API PATCH `/api/areas/[id]` con trasferimento manager in cascata. Nuova pagina `/admin/equita` (solo admin) con panoramica cross-area e badge salute. API `/api/equity-overview`. NavbarAdmin: voce "Equità" per admin. `generateTurniExcel`: A1 (nome area) e B51 (cognome manager) da DB via `areaId`. Seed: Area2-Liguria con manager; nomi utenti unici.
- **[2026-03-25] Multi-area — bug fix email settings e UI selettore area** — Email settings isolate per area: POST include `area_id` nel profilo e nell'insert; PATCH/DELETE filtrano con `.eq('area_id', authResult.areaId)`. Pagina `/admin/disponibilita` accetta `searchParams` e usa `AreaSelector` per navigare tra aree. Filtro area in `ListaUtenti` convertito da pill a `<select>` dropdown. Badge "Aree" in dashboard admin.
- **[2026-03-25] Seed DB 14 aree** — Create Area1-Area14 con regioni italiane (Piemonte, Liguria, Lombardia, Veneto, Emilia-Romagna, Toscana, Lazio, Campania, Puglia, Sicilia, Sardegna, Abruzzo, Calabria, Marche). Ogni area ha 1 manager e 8-18 dipendenti. 15.780 disponibilita fittizie per tutti i dipendenti per i weekend del 2026.
- **[2026-03-24] reperibile_order su shifts (migration 012)** — Colonna `reperibile_order` (1 o 2) su `shifts`. Import: D→1, E→2. Export: ordina per `reperibile_order` → D/E sempre corretti. API `/api/shifts`: calcola automaticamente 1° o 2° in base a chi è già assegnato nel giorno; unifica il check `workers_per_day` per entrambi i valori. Drawer: badge "1°"/"2°" in Assegnati.
- **[2026-03-24] Storico festivi nel drawer** — Per ogni festivo obbligatorio, sotto ogni nome utente appare "lavorato [nome] '[anno]" se ha lavorato quel festivo in anni precedenti. Query client-side su `holidays` (mandatory, year < corrente) + `shifts` su quelle date. Score non modificato.
- **[2026-03-24] Pairing con conferma (tutti i modi)** — `weekend_full`: click Sab chiede conferma per Dom e viceversa. `sun_next_sat`: click Dom chiede conferma per Sab+7. In entrambi i casi il manager può scegliere "Solo Sab" / "Solo Dom". L'auto-pairing silenzioso è stato rimosso completamente. Dialog dinamico: testo e bottoni si adattano al giorno abbinato.
- **[2026-03-24] Festività anni futuri** — Import manuale via bottone "Aggiorna festivita {anno}" in pagina Sistema. Usa API Nager.Date (`/api/v3/PublicHolidays/{year}/IT`) per qualsiasi anno tra 2024 e 2030. Upsert sicuro: se l'anno e gia presente, non duplica ma restituisce i record esistenti.
- **[2026-03-23] Email notifica mese confermato** — Implementato con **Brevo** (brevo.com, free tier 300/giorno). `lib/email/sendTurniEmail.ts`: HTML + text + allegato Excel base64, BCC per tutti i destinatari. Auto-invio su export GET se `!email_inviata`; invio manuale via POST `/api/send-email`. Env vars: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.
- **[2026-03-23] Mesi confirmed immutabili** — Manager non puo sbloccare mesi `confirmed`; solo admin puo con dialog di conferma. CalendarioGlobale: `isConfirmed` prop separata da `locked`.
- **[2026-03-23] Admin aggiunto alla navbar Disponibilita** — Admin accede al CalendarioGlobale e puo sbloccare mesi confirmed.
- **[v1.2.0] Fix logout admin mobile** — Il pulsante "Altro" nella bottom bar mobile di `NavbarAdmin` e ora sempre visibile, garantendo accesso al logout anche per il ruolo admin che non ha voci nel menu overflow.
- **[v1.2.0] Loading skeleton su tutte le pagine SSR** — Aggiunto `loading.tsx` per tutte le route admin e user. Componente condiviso `AdminPageSkeleton` con `rows` e `grid` props. Elimina la pagina bianca durante il caricamento SSR.
- **[v1.2.0] StoricoTurni — conversione a server component** — `StoricoTurni.tsx` ora riceve `turni: ShiftRow[]` come prop da `app/user/page.tsx`; la query storico (ultimi 12 mesi) e aggiunta nel `Promise.all` della pagina; join con `month_status` in memoria tramite `statusMap`. Eliminato doppio round-trip client→server.
- **[v1.1.0] Refactor type safety** — Convertiti tutti i tipi in `lib/supabase/types.ts` da `interface` a `type`; rimossi 38 `eslint-disable any` e tutti i cast `as any`; rimossi ~40 cast ridondanti su risultati query Supabase; corretti 4 bug reali emersi (status literals, `.upsert()` → `.update()`, null→undefined in GestioneTemplate); versione mostrata nella sidebar admin.
- Export Excel su template aziendale — JSZip modifica solo `xl/worksheets/sheet1.xml`, il resto del template (logo, firma, conditional formatting) rimane intatto. Cognome only, rosso weekend su D/E via inline rich text.
- Score equita — suggeriti ordinati per `turni_totali` grezzo (non score ponderato), con delta sessione via `sessionCounts`
- Sab+Dom stesso reperibile — domenica suggerisce automaticamente chi ha lavorato il sabato della stessa settimana
- Fix API festivo su domenica — il pair Sab+Dom viene escluso correttamente anche quando il festivo cade di domenica (es. Pasqua)
- Ruolo manager con RLS — funzione `is_admin_or_manager()`, accesso a calendario, turni, statistiche, export, utenti dipendenti
- Template multipli per nome, export con selezione dinamica
- Dashboard admin riprogettata — contatori utenti, stato template, accesso rapido
- Dashboard manager — card mese corrente/prossimo con stato colorato, turni collapsibili
- Calendario festivita — import Nager.Date, toggle Attiva/Non attiva, aggiunta manuale, elimina, anni collassabili
- Importa storico reperibilita — multi-file, upload sequenziale, match per cognome, upsert + lock automatico
- Semantica `mandatory` semplificata — attiva = visibile + 3 pt + assegnabile; non attiva = ignorata completamente
- Score equita semplificato (migration 010) — 2 livelli: normale = 1 pt, festivo attivo = 3 pt; rimosso il livello fest_comandate
- Layout Sistema a 2 colonne
- Gestione utenti per ruolo — admin vede manager + dipendenti, manager vede solo dipendenti (ruolo non modificabile)
- Rename "Export" → "Invio turni" in navbar manager
- Lista turni: weekend Sab+Dom raggruppati in riga unica
- `month_status.status = 'confirmed'` impostato automaticamente dopo il download Excel
