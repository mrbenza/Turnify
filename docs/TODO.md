# TODO — Turnify

Funzionalità da implementare in ordine di priorità.

---

## Alta priorità

### Export Excel su template aziendale
- L'utente deve fornire il **template Excel** di riferimento
- Attualmente l'export genera un file semplice
- Da convertire in XLSX che segue il modello aziendale

---

## Media priorità

### Email notifica mese confermato
- Integrare **Resend** (resend.com) per invio email automatico alla conferma mese
- La tabella `email_settings` è già pronta su Supabase
- Le colonne `email_inviata` e `email_inviata_at` sono già su `month_status`
- Logica: invio a tutti i dipendenti + indirizzi extra in `email_settings`
- Dopo invio: rollback mese non più possibile
- Da installare: `npm install resend`
- Variabile d'ambiente da aggiungere: `RESEND_API_KEY=re_...`

---

## Bassa priorità

### Festività anni futuri
- Aggiungere festività per anni successivi al 2026
- Valutare se far gestire le festività all'admin da UI (oggi solo da DB/SQL)

### Rotazione festivi comandati (es. Pasqua ogni 10 anni)
- **Obiettivo**: chi lavora un festivo comandato non dovrebbe riprenderlo per ~10 anni (con 10 persone in rotazione)
- **Situazione attuale**: lo score ponderato (festivo ×2, fest_cmd ×3) è solo cosmetic nella dashboard; il suggerito usa `turni_totali` grezzo (+1 per qualsiasi turno), quindi i festivi comandati non danno vantaggi reali nella rotazione
- **Opzione A**: ricalibrate i moltiplicatori score e usarli nel suggerito (es. fest_cmd = 480 punti = 4 wknd/mese × 12 mesi × 10 anni)
- **Opzione B**: blacklist per festivo specifico — chi ha lavorato Pasqua quest'anno non viene suggerito per Pasqua per N anni (tracciamento cross-anno separato)
