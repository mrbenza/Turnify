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
| PWA-02 | Progettare persistenza notifiche | Schema DB, RLS e strategia per subscription multiple per utente | Da fare | Tabelle candidate: `push_subscriptions` e `notification_events` |
| PWA-03 | Rendere Turnify installabile | Manifest, icone, metadati e service worker registrato | Da fare | Verificare installazione su Edge desktop e Android |
| PWA-04 | Gestire consenso utente | Attivazione, disattivazione e stato del permesso notifiche dalla UI | Da fare | Il permesso deve essere richiesto dopo un'azione esplicita dell'utente |
| PWA-05 | Salvare le subscription | API autenticate per creare, aggiornare e revocare subscription Web Push | Da fare | Uno stesso utente puo avere piu dispositivi/browser |
| PWA-06 | Implementare invio Web Push | Invio server-side con VAPID e gestione endpoint non piu validi | Da fare | Conservare la chiave privata solo lato server |
| PWA-07 | Collegare invio alla conferma | Creazione evento e invio notifiche alla prima conferma operativa del mese | Da fare | Deve essere idempotente e non duplicare gli invii |
| PWA-08 | Gestire apertura notifica | Il click apre la pagina utente pertinente | Da fare | Destinazione iniziale proposta: `/user` |
| PWA-09 | Definire fallback email | Email ed Excel restano azioni opzionali successive alla pubblicazione | Completato | Le notifiche push rappresentano il canale operativo principale |
| PWA-10 | Test end-to-end | Verifica permessi, ricezione a PWA chiusa, multi-device, retry e revoca | Da fare | Testare almeno Edge desktop e Android |
| PWA-11 | Rilascio graduale | Attivazione controllata, monitoraggio errori e documentazione operativa | Da fare | Evitare l'attivazione globale senza osservabilita |

## Decisioni aperte

| ID | Decisione | Opzioni da valutare | Stato |
|---|---|---|---|
| D-01 | Qual e la conferma operativa che genera notifiche? | Una nuova azione esplicita di conferma definitiva, successiva al blocco reversibile `lock` | Completato |
| D-02 | Chi riceve la notifica? | Tutti i dipendenti attivi appartenenti all'area confermata | Completato |
| D-03 | L'email resta attiva? | Resta disponibile come invio manuale opzionale, senza modificare lo stato del mese | Completato |
| D-04 | Quali eventi conservare? | Conservare `month_published` e ogni `month_republished`; lo sblocco non genera notifiche | Completato |

## Bug e rischi da controllare

| ID | Descrizione | Comportamento attuale | Comportamento richiesto | Stato |
|---|---|---|---|---|
| BUG-PWA-01 | L'importazione storico imposta i mesi passati su `confirmed` | `POST /api/import-shifts` usa `confirmed` per un mese passato, correttamente per rappresentarne lo stato storico | L'import storico non deve mai generare notifiche push o invii email, ne interferire con lo stato degli invii | Da controllare |
| RISK-PWA-01 | Esistono piu percorsi che impostano `month_status.status = confirmed` | Export, invio email e import storico possono scrivere lo stesso stato | L'invio deve dipendere da un evento applicativo esplicito e idempotente, non da un trigger generico su ogni `confirmed` | Da controllare |
| RISK-PWA-02 | Uno stesso utente puo avere piu subscription | Ogni browser e dispositivo genera un endpoint diverso | Conservare subscription multiple e rimuovere solo gli endpoint scaduti o revocati | Da fare |

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
- possiedono almeno una subscription Web Push attiva.

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
