# Checklist per Verificare e Risolvere l'Integrazione Stripe

Questo documento ti guida passo passo per verificare e risolvere eventuali problemi con l'integrazione Stripe.

## ✅ Cosa è già implementato

1. **Reindirizzamento a Stripe Hosted Checkout** ✅
   - L'utente viene reindirizzato alla pagina di pagamento Stripe quando clicca "Paga"
   - Implementato in `src/pages/Cart.tsx` tramite la funzione `create-stripe-checkout`

2. **Aggiornamento automatico del database dopo il pagamento** ✅
   - Il webhook Stripe aggiorna automaticamente:
     - `cart = false` (carrello svuotato)
     - `status = 'confirmed'` (prenotazione confermata)
     - `stripe_checkout_session_id` (salvato per tracciamento)

3. **Invio email di conferma al cliente** ✅
   - Email automatica inviata al cliente quando il pagamento è completato

4. **Invio email di notifica al negozio** ❌ (RIMOSSO)
   - Le email al negozio sono state rimosse
   - Il negozio può vedere le prenotazioni confermate nel dashboard admin

5. **Verifica firma Stripe** ✅ (NUOVO - SICUREZZA)
   - Il webhook ora verifica la firma di Stripe per garantire che le richieste siano autentiche

## 🔧 Cosa devi verificare/configurare

### 1. Variabili d'Ambiente in Supabase

Vai su **Supabase Dashboard** > **Project Settings** > **Edge Functions** > **Secrets** e verifica che siano configurate:

- ✅ `STRIPE_SECRET_KEY` - La tua chiave segreta Stripe (sk_test_... o sk_live_...)
- ✅ `STRIPE_WEBHOOK_SECRET` - Il signing secret del webhook (whsec_...)
- ✅ `SITE_URL` - URL del tuo sito (es: https://demo.nollix.it)
- ✅ `RESEND_API_KEY` - Chiave API di Resend per l'invio email

### 2. Configurazione Webhook Stripe

1. Vai su **Stripe Dashboard** > **Developers** > **Webhooks**
2. Verifica che il webhook sia configurato con l'URL corretto:
   ```
   https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook?apikey=[ANON_KEY]
   ```
   - Sostituisci `[PROJECT_REF]` con il tuo Project Reference ID
   - Sostituisci `[ANON_KEY]` con la tua anon key di Supabase

3. Verifica che il webhook ascolti l'evento:
   - ✅ `checkout.session.completed`

4. Verifica che il webhook sia **attivo** (toggle verde)

### 3. Deploy delle Edge Functions

Assicurati che le seguenti funzioni siano deployate:

1. **`create-stripe-checkout`**
   - File: `supabase/functions/create-stripe-checkout/index.ts`
   - Crea la sessione di checkout Stripe

2. **`stripe-webhook`** ⚠️ **AGGIORNATA**
   - File: `supabase/functions/stripe-webhook/index.ts`
   - Gestisce gli eventi Stripe e aggiorna il database
   - **Devi ridistribuire questa funzione** con le nuove modifiche!

3. **`send-email`**
   - File: `supabase/functions/send-email/index.ts`
   - Invia le email tramite Resend

**Come deployare tramite Dashboard Supabase:**
1. Vai su **Supabase Dashboard** > **Edge Functions**
2. Trova `stripe-webhook` nella lista
3. Clicca sui **tre puntini (...)** > **Edit**
4. Copia tutto il contenuto da `supabase/functions/stripe-webhook/index.ts`
5. Incolla nell'editor della dashboard
6. Clicca **Deploy** o **Save**

### 4. Test del Flusso Completo

#### Test 1: Creazione Checkout Session
1. Aggiungi prodotti al carrello
2. Vai al carrello
3. Clicca "Paga"
4. **Verifica:** Dovresti essere reindirizzato a Stripe

#### Test 2: Pagamento di Test
1. Usa una carta di test Stripe:
   - Numero: `4242 4242 4242 4242`
   - CVC: qualsiasi 3 cifre (es: `123`)
   - Scadenza: qualsiasi data futura (es: `12/2025`)
2. Completa il pagamento su Stripe
3. **Verifica:** Dovresti essere reindirizzato a `/payment-success`

#### Test 3: Verifica Database
1. Vai su **Supabase Dashboard** > **Table Editor** > **bookings**
2. Trova la prenotazione appena pagata
3. **Verifica:**
   - ✅ `cart` = `false`
   - ✅ `status` = `confirmed`
   - ✅ `stripe_checkout_session_id` è presente

#### Test 4: Verifica Email
1. Controlla la casella email del cliente
2. **Verifica:** Email di conferma ricevuta

#### Test 5: Verifica Webhook
1. Vai su **Stripe Dashboard** > **Developers** > **Webhooks**
2. Clicca sul tuo endpoint webhook
3. Vai su **Recent deliveries**
4. Cerca l'evento `checkout.session.completed` relativo al pagamento
5. **Verifica:**
   - ✅ Stato: **Succeeded (200)**
   - ✅ Response: `{"success":true,"received":true}`

## 🐛 Troubleshooting

### Il webhook non viene chiamato

**Possibili cause:**
- URL del webhook errato
- Webhook disattivato
- Modalità Stripe errata (Test vs Live)

**Soluzione:**
1. Verifica l'URL del webhook in Stripe
2. Assicurati che il webhook sia attivo
3. Verifica che stai usando le chiavi corrette (test o live)

### Il webhook viene chiamato ma fallisce (401 Unauthorized)

**Causa:** L'URL del webhook non include la chiave API

**Soluzione:**
1. Vai su Stripe Dashboard > Developers > Webhooks
2. Modifica l'URL del webhook aggiungendo `?apikey=[ANON_KEY]` alla fine
3. Salva

### Il pagamento è completato ma la prenotazione non viene aggiornata

**Possibili cause:**
- Il webhook non è stato chiamato
- Il webhook ha fallito
- Errore nel database

**Soluzione:**
1. Controlla i log del webhook in Stripe (Recent deliveries)
2. Controlla i log delle Edge Functions in Supabase
3. Verifica che `STRIPE_WEBHOOK_SECRET` sia configurato correttamente
4. Verifica che il `booking_id` sia presente nei metadati della sessione Stripe

### Le email non vengono inviate

**Possibili cause:**
- `RESEND_API_KEY` non configurata
- Errore nella funzione `send-email`

**Soluzione:**
1. Verifica che `RESEND_API_KEY` sia configurata in Supabase
2. Verifica i log della funzione `send-email` in Supabase

### Errore "Firma non valida" nel webhook

**Causa:** La verifica della firma Stripe fallisce

**Soluzione:**
1. Verifica che `STRIPE_WEBHOOK_SECRET` sia corretto
2. Assicurati di usare il signing secret corretto (test o live)
3. Verifica che il webhook sia nella stessa modalità delle tue chiavi API

## 📋 Checklist Completa

Segui questa checklist in ordine:

```
□ 1. Variabili d'ambiente configurate in Supabase
   □ STRIPE_SECRET_KEY
   □ STRIPE_WEBHOOK_SECRET
   □ SITE_URL
   □ RESEND_API_KEY

□ 2. Webhook Stripe configurato
   □ URL corretto con anon key
   □ Evento checkout.session.completed selezionato
   □ Webhook attivo

□ 3. Edge Functions deployate
   □ create-stripe-checkout
   □ stripe-webhook (AGGIORNATA - ridistribuire!)
   □ send-email

□ 4. Test completato
   □ Creazione checkout session funziona
   □ Pagamento di test completato
   □ Database aggiornato correttamente
   □ Email cliente ricevuta
   □ Webhook chiamato con successo

□ 5. Verifica produzione (quando pronto)
   □ Chiavi live di Stripe configurate
   □ Webhook in modalità Live
   □ SITE_URL aggiornato con dominio produzione
```

## 🎯 Flusso Completo del Pagamento

1. **Utente clicca "Paga"** nel carrello
   - Frontend chiama `create-stripe-checkout` Edge Function
   - La funzione crea una Stripe Checkout Session
   - L'utente viene reindirizzato a Stripe

2. **Utente completa il pagamento su Stripe**
   - Stripe processa il pagamento
   - Stripe reindirizza l'utente a `/payment-success`

3. **Stripe chiama il webhook** (automatico)
   - Evento: `checkout.session.completed`
   - Il webhook verifica la firma Stripe
   - Il webhook aggiorna il database:
     - `cart = false`
     - `status = 'confirmed'`
     - `stripe_checkout_session_id = session.id`
   - Il webhook invia email al cliente

4. **Risultato finale**
   - ✅ Pagamento completato
   - ✅ Carrello svuotato
   - ✅ Prenotazione confermata
   - ✅ Email cliente inviata
   - ✅ Prenotazione visibile nel dashboard admin

## 📞 Supporto

Se continui ad avere problemi dopo aver seguito questa checklist:

1. Controlla i log delle Edge Functions in Supabase
2. Controlla i log del webhook in Stripe
3. Verifica che tutte le variabili d'ambiente siano corrette
4. Testa con una carta di test Stripe prima di passare in produzione

