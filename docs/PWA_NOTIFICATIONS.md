# PWA e notifiche Web Push

Tracker di progetto per rendere Turnify installabile come PWA e notificare i
dipendenti quando i turni di un mese vengono confermati.

## Stati

| Stato | Significato |
|---|---|
| Da fare | Attivita non ancora iniziata |
| In corso | Attivita attualmente in lavorazione |
| Bloccato | Richiede una decisione o una dipendenza esterna |
| Completato | Implementato e verificato |

## Piano di lavoro

| ID | Step | Risultato atteso | Stato | Note |
|---|---|---|---|---|
| PWA-01 | Definire evento e destinatari | Regola univoca che stabilisce quando inviare la notifica e a chi | Completato | Evento generato dalla conferma definitiva del manager; destinatari: dipendenti attivi dell'area |
| PWA-02 | Progettare persistenza notifiche | Schema DB, RLS e strategia per subscription multiple per utente | Completato | Migration applicate e verificate sul database; accesso riservato al service role |
| PWA-03 | Rendere Turnify installabile | Manifest, icone, metadati, service worker e banner di installazione dopo il login | Completato | Installazione verificata su Chrome ed Edge; banner disponibile a tutti i ruoli dopo il login |
| PWA-04 | Gestire consenso utente | Attivazione, disattivazione e stato del permesso notifiche dalla UI | Completato | Richiesta esplicita mostrata solo nella PWA installata e dopo il login; verificato su Chrome Android, Edge compatibile ma mostra avvisi propri del browser |
| PWA-05 | Salvare le subscription | API autenticate per creare, aggiornare e revocare subscription Web Push | Completato | API implementata e verificata con subscription reali; uno stesso utente puo avere piu dispositivi/browser |
| PWA-06 | Implementare invio Web Push | Invio server-side con VAPID e gestione endpoint non piu validi | Completato | Motore di invio verificato con test manuali reali e mock di revoca; invio pubblicazione mese resta PWA-07 |
| PWA-07 | Collegare invio alla conferma | Creazione evento e invio notifiche alla prima conferma operativa del mese | Da fare | Deve essere idempotente e non duplicare gli invii |
| PWA-08 | Gestire apertura notifica | Il click apre la pagina utente pertinente | Da fare | Destinazione iniziale proposta: `/user` |
| PWA-09 | Definire fallback email | Email ed Excel restano azioni opzionali successive alla pubblicazione | Completato | Le notifiche push rappresentano il canale operativo principale |
| PWA-10 | Test end-to-end | Verifica permessi, ricezione a PWA chiusa, multi-device, retry e revoca | Da fare | Testare almeno Edge desktop e Android |
| PWA-11 | Rilascio graduale | Attivazione controllata, monitoraggio errori e documentazione operativa | Da fare | Evitare l'attivazione globale senza osservabilita |
| PWA-12 | Pagina diagnostica admin | Vista Debug per utenti, subscription, consegne, cleanup manuale e azioni diagnostiche | In corso | Pagina disponibile solo ad admin con debug attivo; endpoint e dati sensibili mascherati |

## Decisioni aperte

| ID | Decisione | Opzioni da valutare | Stato |
|---|---|---|---|
| D-01 | Qual e la conferma operativa che genera notifiche? | Una nuova azione esplicita di conferma definitiva, successiva al blocco reversibile `lock` | Completato |
| D-02 | Chi riceve la notifica? | Tutti i dipendenti attivi appartenenti all'area confermata | Completato |
| D-03 | L'email resta attiva? | Resta disponibile come invio manuale opzionale, senza modificare lo stato del mese | Completato |
| D-04 | Quali eventi conservare? | Conservare `month_published` e ogni `month_republished`; lo sblocco non genera notifiche | Completato |
| D-05 | Quanto deve durare una subscription senza accessi recenti? | Deve restare attiva anche dopo logout o oltre 20 giorni senza accessi; viene revocata solo esplicitamente o dopo risposta `404`/`410` dal push service | Completato |
| D-06 | Cosa succede alle subscription degli utenti disattivati? | Restano nel database per diagnostica admin, ma gli utenti con `attivo = false` sono sempre esclusi dagli invii automatici | Completato |
| D-07 | Quali subscription usare negli invii automatici? | Solo quelle registrate dalla PWA installata; eventuali subscription create dal browser restano diagnostiche o di cleanup | Completato |

## Bug e rischi da controllare

| ID | Descrizione | Comportamento attuale | Comportamento richiesto | Stato |
|---|---|---|---|---|
| BUG-PWA-01 | L'importazione storico imposta i mesi passati su `confirmed` | `POST /api/import-shifts` usa `confirmed` per un mese passato, correttamente per rappresentarne lo stato storico | L'import storico non deve mai generare notifiche push o invii email, ne interferire con lo stato degli invii | Da controllare |
| RISK-PWA-01 | Esistono piu percorsi che impostano `month_status.status = confirmed` | Export, invio email e import storico possono scrivere lo stesso stato | L'invio deve dipendere da un evento applicativo esplicito e idempotente, non da un trigger generico su ogni `confirmed` | Da controllare |
| RISK-PWA-02 | Uno stesso utente puo avere piu subscription | Ogni browser e dispositivo genera un endpoint diverso | Conservare subscription multiple e rimuovere solo gli endpoint scaduti o revocati | Completato |

## Vincolo importazione storico

L'importazione storico puo continuare a impostare `month_status.status` su
`confirmed` per i mesi passati. Questo stato descrive correttamente un mese gia
concluso, ma non rappresenta una nuova conferma operativa.

Di conseguenza:

- non deve creare un evento di notifica;
- non deve inviare email;
- non deve modificare indicatori relativi a notifiche o email gia inviate;
- eventuali trigger o automazioni future non devono basarsi esclusivamente sul
  passaggio a `status = confirmed`.

## Specifica PWA-01: evento e destinatari

### Evento applicativo

La notifica viene generata quando un manager conferma definitivamente un mese
gia salvato e bloccato.

Questa azione:

- richiede che il mese si trovi gia nello stato `locked`;
- rappresenta il momento in cui i turni diventano definitivi per i dipendenti;
- imposta `month_status.status = confirmed`;
- crea un evento applicativo `month_published`, indipendente dal valore
  `confirmed` usato anche dall'importazione storico.

Il primo pulsante del manager, rinominato `Salva`, continua invece a eseguire
`POST /api/month` con `action = lock`. Questo blocco:

- impedisce ai dipendenti di modificare le disponibilita;
- impedisce modifiche ai turni finche non viene annullato;
- puo essere annullato dal manager;
- non genera notifiche push o email.

Non generano eventi di notifica:

- il pulsante `Salva` e l'azione tecnica `lock`;
- export o download Excel;
- invio email manuale;
- importazione storico;
- scritture dirette o tecniche di `month_status.status = confirmed`;
- richieste di conferma ripetute mentre il mese e gia `confirmed`.

### Riconferma dopo modifiche

Se un amministratore sblocca un mese `confirmed`, vengono apportate modifiche,
il manager lo salva e poi lo conferma nuovamente, viene creato un nuovo evento
`month_republished`.

La riconferma deve inviare una nuova notifica con testo che segnali
l'aggiornamento dei turni. Ogni singolo evento deve restare idempotente, in modo
che retry tecnici non producano notifiche duplicate.

### Destinatari

Ricevono l'evento tutti i dipendenti che, al momento della conferma:

- hanno `attivo = true`;
- appartengono alla stessa `area_id` del mese confermato;
- possiedono almeno una subscription Web Push attiva registrata dalla PWA
  installata.

Se un manager disattiva un dipendente (`users.attivo = false`), le sue
subscription non vengono cancellate automaticamente: restano disponibili alla
diagnostica admin, ma non possono essere selezionate dagli invii automatici di
pubblicazione mese. L'admin decide successivamente se eliminare, riattivare o
gestire manualmente l'utente.

La notifica non e limitata ai soli dipendenti con un turno assegnato: la
pubblicazione del calendario mensile interessa l'intera area e comunica anche
l'assenza di turni.

Manager, amministratori e indirizzi configurati in `email_settings` non sono
destinatari delle notifiche push del mese.

### Contenuto iniziale

- Prima pubblicazione:
  `Turni di {mese} {anno} confermati. Consulta il calendario.`
- Pubblicazione aggiornata:
  `I turni di {mese} {anno} sono stati aggiornati. Consulta il calendario.`
- Destinazione al click: `/user`

### Stati e azioni UI

| Stato DB | Significato UI | Azioni manager | Sblocco |
|---|---|---|---|
| `open` | In lavorazione | Modifica turni, `Salva` | Non applicabile |
| `locked` | Salvato, in attesa di conferma definitiva | `Conferma mese`, annulla salvataggio | Manager |
| `confirmed` | Confermato e pubblicato | Scarica Excel, invia email | Solo amministratore |

### Flusso pagina Invio turni

| Step | Titolo | Funzione |
|---|---|---|
| 1 | Seleziona periodo | Seleziona mese, anno ed eventuale template |
| 2 | Controlla turni | Mostra riepilogo, copertura, turni e stato delle notifiche |
| 3 | Conferma mese | Pubblica definitivamente il mese e invia le notifiche push |
| 4 | Genera e invia - opzionale | Permette di scaricare il file Excel o inviare manualmente l'email |

Lo step 3 non richiede una finestra di conferma aggiuntiva: tutte le
informazioni necessarie devono essere visibili nello step 2. Lo step 3 mostra
solamente una breve descrizione degli effetti irreversibili per il manager e il
pulsante `Conferma e pubblica`.

Lo step 4:

- e chiaramente indicato come opzionale;
- compare solo dopo la conferma definitiva;
- mantiene separate le azioni `Scarica Excel` e `Invia email`;
- non modifica lo stato del mese;
- non genera notifiche push;
- non e necessario per completare il flusso operativo.

## Specifica PWA-02: persistenza notifiche

La persistenza e divisa in tre responsabilita:

1. registrare i browser e dispositivi abilitati;
2. registrare una singola pubblicazione logica del mese;
3. registrare l'esito dell'invio a ogni subscription.

### Tabella `push_subscriptions`

Una riga rappresenta una subscription Web Push di uno specifico browser o
dispositivo. Uno stesso utente puo avere piu righe.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | Identificativo interno |
| `user_id` | uuid FK users | `ON DELETE CASCADE` |
| `endpoint` | text UNIQUE | Endpoint Web Push completo |
| `p256dh` | text | Chiave pubblica della subscription |
| `auth` | text | Segreto auth della subscription |
| `expiration_time` | timestamptz nullable | Se fornito dal browser |
| `user_agent` | text nullable | Informazione diagnostica |
| `client_mode` | text | `standalone` per PWA installata, `browser` per navigazione web |
| `created_at` | timestamptz | Data prima registrazione |
| `updated_at` | timestamptz | Data ultimo aggiornamento |
| `last_seen_at` | timestamptz | Ultima conferma dal browser |
| `last_success_at` | timestamptz nullable | Ultimo invio riuscito |
| `failure_count` | integer | Errori consecutivi |
| `revoked_at` | timestamptz nullable | Subscription disattivata |
| `revoked_reason` | text nullable | `manual_user`, `manual_admin`, `push_service_gone` |
| `revoked_by` | uuid nullable | Admin che ha revocato manualmente, se disponibile |

Regole:

- `endpoint` e univoco globalmente;
- una nuova registrazione dello stesso endpoint aggiorna la riga esistente;
- il prompt di attivazione notifiche viene mostrato solo nella PWA installata,
  non durante la semplice navigazione da browser;
- gli invii automatici usano solo subscription `standalone`, per evitare
  doppioni quando lo stesso utente ha abilitato notifiche sia da browser sia
  dalla PWA;
- le subscription `browser` possono restare visibili in diagnostica admin per
  test o pulizia manuale;
- una subscription revocata non viene usata per nuovi invii;
- risposte push `404` o `410` impostano `revoked_at` e `revoked_reason = push_service_gone`;
- il logout non revoca la subscription: le notifiche devono poter arrivare
  anche dopo lunghi periodi senza accessi;
- la subscription viene revocata solo su richiesta esplicita dell'utente o
  quando il push service restituisce `404` o `410`.
- a ogni apertura/login della PWA installata, se il permesso notifiche e gia
  `granted`, il client controlla `pushManager.getSubscription()`: se la
  subscription esiste la sincronizza con il DB, se manca la ricrea e la salva.

### Tabella `notification_events`

Una riga rappresenta una pubblicazione logica di un mese, non un singolo invio.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | Identificativo evento |
| `event_type` | text | `month_published` oppure `month_republished` |
| `area_id` | uuid FK areas | Area destinataria |
| `month` | integer | 1-12 |
| `year` | integer | Anno del mese |
| `publication_number` | integer | 1 per prima pubblicazione, crescente per ripubblicazioni |
| `created_by` | uuid FK users | Manager o admin che conferma |
| `created_at` | timestamptz | Data creazione evento |
| `status` | text | `pending`, `sending`, `sent`, `partial`, `failed` |
| `completed_at` | timestamptz nullable | Fine elaborazione |

Vincolo di idempotenza:

`UNIQUE (area_id, month, year, publication_number)`

La prima conferma crea `publication_number = 1` e `month_published`. Una nuova
conferma dopo lo sblocco amministrativo crea il numero successivo e
`month_republished`. Import storico, export ed email non creano eventi.

La transizione `locked -> confirmed` e la creazione dell'evento devono avvenire
nella stessa transazione database, tramite una funzione server-side dedicata.
Questo impedisce che richieste concorrenti creino pubblicazioni duplicate o un
mese confermato senza il relativo evento.

### Tabella `notification_deliveries`

Una riga rappresenta il tentativo di consegna di un evento a una subscription.
Serve per errori parziali, retry e controllo dei duplicati.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | Identificativo consegna |
| `event_id` | uuid FK notification_events | `ON DELETE CASCADE` |
| `subscription_id` | uuid FK push_subscriptions nullable | `ON DELETE SET NULL` |
| `user_id` | uuid FK users nullable | Snapshot destinatario |
| `status` | text | `pending`, `sent`, `failed`, `revoked` |
| `attempts` | integer | Numero tentativi |
| `last_attempt_at` | timestamptz nullable | Ultimo tentativo |
| `sent_at` | timestamptz nullable | Consegna riuscita |
| `http_status` | integer nullable | Risposta del push service |
| `error` | text nullable | Messaggio diagnostico sanificato |

Vincolo anti-duplicazione:

`UNIQUE (event_id, subscription_id)`

Le righe vengono create usando le subscription attive dei dipendenti attivi
dell'area al momento della pubblicazione. In questo modo i destinatari
dell'evento restano determinati anche se successivamente cambiano area o stato.

### RLS e accesso

Le tre tabelle contengono endpoint e dati operativi sensibili. Non saranno
accessibili direttamente dal client Supabase:

- RLS abilitata su tutte le tabelle;
- nessuna policy diretta per `anon` o `authenticated`;
- letture e scritture effettuate esclusivamente da API Next.js autenticate;
- le API usano il service client dopo avere verificato utente, ruolo e area;
- i manager possono ricevere solo conteggi aggregati;
- gli admin possono consultare i dati diagnostici tramite una pagina dedicata,
  ma non possono visualizzare endpoint completi, chiavi `p256dh` o segreti
  `auth`.

Le chiavi VAPID non vengono salvate nel database:

- chiave pubblica disponibile al browser tramite configurazione pubblica;
- chiave privata conservata esclusivamente nelle variabili ambiente server.

### Indici previsti

- `push_subscriptions (user_id)` con filtro sulle righe non revocate;
- `notification_events (area_id, year, month)`;
- `notification_deliveries (event_id, status)`;
- `notification_deliveries (subscription_id)`.

## Specifica PWA-06: invio Web Push

PWA-06 implementa il motore server-side che invia notifiche Web Push e registra
gli esiti. Non decide quando pubblicare un mese: quel collegamento appartiene a
PWA-07.

### Confine dello step

Incluso in PWA-06:

- configurazione VAPID lato server;
- invio Web Push a una o piu subscription gia presenti nel database;
- creazione di eventi diagnostici `test`;
- creazione e aggiornamento delle righe `notification_deliveries`;
- aggiornamento di `last_success_at`, `failure_count` e `revoked_at`;
- revoca automatica degli endpoint quando il push service risponde `404` o
  `410`;
- invio manuale da pagina debug admin.

Escluso da PWA-06:

- scelta automatica dei destinatari della pubblicazione mese;
- invio automatico dopo `Conferma e pubblica`;
- retry pianificati o code asincrone;
- conferma che la notifica sia stata visualizzata sul dispositivo.

Il browser/push service puo confermare solo l'accettazione dell'invio. La
visualizzazione effettiva sul dispositivo non e garantibile lato server.

### Configurazione

Le variabili ambiente richieste sono:

| Variabile | Uso |
|---|---|
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Chiave pubblica usata dal browser per creare la subscription |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Chiave privata usata solo dal server per firmare l'invio |
| `WEB_PUSH_SUBJECT` | Contatto VAPID, ad esempio `mailto:admin@turnify.vercel.app` |

Se manca una variabile, l'invio deve fallire con errore server e non deve
marcare la delivery come `sent`.

### Payload

Payload minimo:

| Campo | Regola |
|---|---|
| `title` | massimo 100 caratteri |
| `body` | massimo 500 caratteri |
| `url` | percorso interno, deve iniziare con `/` e non puo essere URL esterno |

Per i test manuali il testo e modificabile dall'admin. Per la pubblicazione
operativa il testo verra definito da PWA-07 usando mese, anno e tipo evento.

### Stati consegna

Ogni invio a una subscription crea o aggiorna una riga
`notification_deliveries`.

| Stato | Significato |
|---|---|
| `pending` | riga creata, invio non ancora concluso |
| `sent` | push service ha accettato la notifica |
| `failed` | errore non definitivo o configurazione non valida |
| `revoked` | endpoint non piu valido, subscription revocata |

`sent_at` indica l'ora di accettazione da parte del push service, non l'ora di
visualizzazione sul telefono.

### Errori e revoche

Regole:

- `404` o `410`: delivery `revoked`, subscription `revoked_at = now`;
- altri status HTTP: delivery `failed`, `failure_count` incrementato;
- invio riuscito: delivery `sent`, `last_success_at = now`,
  `failure_count = 0`;
- PWA-06 non introduce retry automatici: ogni invio esegue un solo tentativo
  immediato. Retry pianificati o code asincrone saranno valutati in uno step
  successivo;
- gli errori salvati in `notification_deliveries.error` devono essere
  sanificati e troncati;
- endpoint, `p256dh`, `auth` e chiave privata VAPID non devono mai comparire
  nella UI o nei log utente.

### Debug e invii automatici

La pagina debug puo inviare notifiche manuali a qualsiasi subscription attiva,
incluse quelle registrate dalla semplice navigazione browser. Questo serve per
diagnostica e cleanup.

Gli invii automatici operativi, invece, useranno solo subscription
`standalone`, cioe registrate dalla PWA installata. Questa regola evita doppie
notifiche quando lo stesso utente ha abilitato notifiche sia da browser sia da
PWA.

### Evento aggregato

Al termine degli invii collegati a uno stesso evento:

| Risultato delivery | Stato evento |
|---|---|
| tutte `sent` | `sent` |
| almeno una `sent` e almeno una `failed`/`revoked` | `partial` |
| nessuna `sent` | `failed` |

`completed_at` viene valorizzato alla fine dell'elaborazione.

### Criteri di chiusura

PWA-06 e completata quando:

- l'invio manuale debug crea evento `test` e delivery per ogni subscription
  selezionata;
- le notifiche arrivano almeno su Chrome Android PWA installata;
- delivery e subscription vengono aggiornate correttamente dopo successo;
- endpoint non validi vengono marcati `revoked`;
- la revoca degli endpoint `404`/`410` e coperta da test unitari o mock senza
  dover rompere manualmente una subscription reale;
- la pagina debug mostra storico, orari, HTTP status ed errori;
- build, lint e test passano.

### Ordine di implementazione

1. creare una migration con tabelle, vincoli, indici e RLS;
2. aggiornare `supabase/schema.sql`;
3. aggiornare i tipi in `lib/supabase/types.ts`;
4. aggiungere test di vincoli, ownership e idempotenza;
5. applicare e verificare la migration sul database solo dopo revisione.

## Specifica PWA-12: diagnostica e cleanup admin

Viene aggiunta una pagina dedicata alle notifiche sotto la sezione `Debug`
della navigazione admin.

- percorso proposto: `/admin/test/notifiche`;
- la voce e visibile solo quando il toggle Debug e attivo;
- la pagina e le relative API verificano sempre `ruolo = admin`;
- il toggle Debug controlla esclusivamente la visibilita della voce e non
  rappresenta un'autorizzazione.

Vista principale per utente:

| Campo | Note |
|---|---|
| Utente | Nome ed email |
| Area | Area corrente |
| Dispositivi registrati | Totale subscription |
| Dispositivi attivi | Subscription non revocate |
| Ultima attivita | Massimo `last_seen_at` |
| Ultima notifica | Evento piu recente |
| Stato ultima notifica | `sent`, `partial`, `failed` |
| Utente attivo | `users.attivo`; gli inattivi sono esclusi dagli automatici |

Dettaglio dispositivi:

| Campo | Note |
|---|---|
| Browser e sistema operativo | Ricavati esclusivamente da `user_agent` |
| Endpoint | Mostrato solo come dominio e suffisso mascherato |
| Registrato il | `created_at` |
| Ultima attivita | `last_seen_at` |
| Ultimo invio riuscito | `last_success_at` |
| Errori consecutivi | `failure_count` |
| Revocato il | `revoked_at` |
| Motivo revoca | `revoked_reason` |
| Ultimo errore | Messaggio diagnostico sanificato |
| Stato diagnostico | Attiva, revocata, browser, PWA installata, vecchia/stale |

Non viene introdotto alcun nome dispositivo personalizzato. L'identificazione
del dispositivo usa solamente il valore `user_agent`, che puo essere
approssimativo.

### Stati da evidenziare

La pagina deve rendere chiari questi casi:

| Caso | Significato | Azione consigliata |
|---|---|---|
| Utente inattivo | `users.attivo = false` | Non inviare automatici; lasciare visibile per valutazione admin |
| Subscription revocata | `revoked_at is not null` | Non inviare; mostrare nello storico/diagnostica |
| Dispositivo vecchio | `last_seen_at` molto distante | Evidenziare per cleanup manuale |
| Browser subscription | `client_mode = browser` | Non usare negli automatici; disponibile per test/cleanup |
| PWA subscription | `client_mode = standalone` | Usabile negli automatici se utente attivo |

La soglia "vecchia/stale" e solo diagnostica, non una scadenza automatica. Non
deve bloccare notifiche operative, perche un utente puo non aprire l'app per
piu di 20 giorni e dover comunque ricevere la notifica.

Azioni diagnostiche admin previste:

- filtrare utenti o consegne con errori;
- consultare lo storico notifiche di un utente;
- revocare manualmente una subscription, ad esempio per telefono formattato,
  guasto, perso, sostituito o problemi notifiche;
- distinguere revoca manuale da revoca automatica `404`/`410`;
- ritentare una consegna fallita;
- inviare una notifica di test a una singola subscription.

La revoca manuale non cancella l'utente e non cambia `users.attivo`: imposta
`push_subscriptions.revoked_at`, `revoked_reason = manual_admin` e `revoked_by`.
Se l'utente reinstallera la PWA o fara un nuovo login con permesso notifiche
gia concesso, la webapp potra creare una nuova subscription valida e salvarla.

### Regole per invii automatici

Gli invii automatici della pubblicazione mese useranno solo subscription che
rispettano tutte queste condizioni:

- utente `attivo = true`;
- ruolo destinatario dipendente;
- stessa area della pubblicazione;
- `push_subscriptions.revoked_at is null`;
- `client_mode = standalone`;
- endpoint ancora valido al momento dell'invio.

Non vengono escluse automaticamente subscription solo per `last_seen_at`
vecchio.

La pagina non mostra mai:

- endpoint Web Push completo;
- chiave `p256dh`;
- segreto `auth`;
- chiave privata VAPID.

### Decisioni e debiti tecnici aperti

- La regola definitiva per le subscription `browser` e ancora da decidere:
  per ora la diagnostica distingue `browser` e `standalone`, ma non si cambia
  la logica gia implementata.
- La pagina debug notifiche non e pronta per volumi produttivi elevati: prima
  della produzione deve imporre ricerca per nome o area e limitare i risultati
  mostrati, evitando liste enormi e paginazione profonda.
- Azione rapida "Revoca notifiche" disponibile solo all'amministratore nella
  tabella `/admin/utenti`, utile per pulire le subscription di un utente senza
  aprire la pagina debug. Il pulsante viene mostrato solo agli utenti con almeno
  una subscription attiva.
- Una subscription revocata manualmente da admin o utente non viene riattivata
  in modo silenzioso quando la PWA viene riaperta con permesso browser ancora
  `granted`.
