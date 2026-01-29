# Debug: Perché Stripe non aggiorna cart e status

## Problema
Stripe riesce a scrivere su `stripe_checkout_session_id` ma non su `cart` e `status`.

## Analisi del Problema

### Quando viene scritto `stripe_checkout_session_id`
Il campo `stripe_checkout_session_id` viene scritto in **due momenti**:

1. **Quando viene creata la sessione Stripe** (funziona ✅)
   - File: `supabase/functions/create-stripe-checkout/index.ts`
   - Viene scritto subito dopo la creazione della sessione
   - Usa `SUPABASE_SERVICE_ROLE_KEY` che bypassa RLS

2. **Quando il webhook viene chiamato** (dovrebbe aggiornare anche cart e status)
   - File: `supabase/functions/stripe-webhook/index.ts`
   - Viene chiamato da Stripe quando il pagamento è completato
   - Dovrebbe aggiornare: `cart = false`, `status = 'confirmed'`, `stripe_checkout_session_id`

### Possibili Cause

#### 1. Il webhook non viene chiamato
**Sintomi:**
- `stripe_checkout_session_id` è presente (scritto da `create-stripe-checkout`)
- `cart` e `status` non vengono aggiornati
- Nessun log nel webhook

**Come verificare:**
1. Vai su **Stripe Dashboard** > **Developers** > **Webhooks**
2. Clicca sul tuo endpoint webhook
3. Vai su **Recent deliveries**
4. Cerca l'evento `checkout.session.completed` relativo al pagamento
5. **Se non c'è:** Il webhook non viene chiamato

**Soluzioni:**
- Verifica che l'URL del webhook sia corretto
- Verifica che il webhook sia attivo (toggle verde)
- Verifica che l'evento `checkout.session.completed` sia selezionato

#### 2. Il webhook viene chiamato ma fallisce (401 Unauthorized)
**Sintomi:**
- Nel dashboard Stripe vedi eventi con stato "Failed"
- Errore: `401 ERR Unauthorized`

**Causa:**
- L'URL del webhook non include la chiave API

**Soluzione:**
1. Vai su **Stripe Dashboard** > **Developers** > **Webhooks**
2. Modifica l'URL del webhook aggiungendo `?apikey=[ANON_KEY]` alla fine
3. L'URL dovrebbe essere: `https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook?apikey=eyJ...`

#### 3. Il webhook viene chiamato ma la verifica della firma fallisce
**Sintomi:**
- Nel dashboard Stripe vedi eventi con stato "Failed"
- Errore: `401 Firma non valida`
- Nei log del webhook vedi: `[STRIPE WEBHOOK] Invalid signature`

**Causa:**
- `STRIPE_WEBHOOK_SECRET` non è corretto
- Il webhook secret non corrisponde all'endpoint

**Soluzione:**
1. Vai su **Stripe Dashboard** > **Developers** > **Webhooks**
2. Clicca sul tuo endpoint
3. Copia il **Signing secret** (inizia con `whsec_`)
4. Vai su **Supabase Dashboard** > **Project Settings** > **Edge Functions** > **Secrets**
5. Aggiorna `STRIPE_WEBHOOK_SECRET` con il valore corretto
6. **Ridistribuisci** la funzione `stripe-webhook`

#### 4. Il webhook viene chiamato ma il payment_status non è 'paid'
**Sintomi:**
- Nel dashboard Stripe vedi eventi con stato "Succeeded (200)"
- Nei log vedi: `[STRIPE WEBHOOK] Payment status is not "paid"`
- `cart` e `status` non vengono aggiornati

**Causa:**
- Il webhook aggiorna solo se `session.payment_status === 'paid'`
- Potrebbe essere che il pagamento non sia ancora stato processato

**Come verificare:**
1. Vai su **Stripe Dashboard** > **Payments**
2. Trova il pagamento relativo alla prenotazione
3. Verifica lo stato del pagamento

**Soluzione:**
- Se il pagamento è in attesa, aspetta che Stripe lo processi
- Se il pagamento è fallito, verifica perché

#### 5. Il webhook viene chiamato ma c'è un errore nell'aggiornamento
**Sintomi:**
- Nel dashboard Stripe vedi eventi con stato "Failed"
- Nei log vedi: `[STRIPE WEBHOOK] Error updating booking:`
- Errore nel database

**Possibili cause:**
- Problemi con RLS (Row Level Security)
- Vincoli del database
- Campi non validi

**Come verificare:**
1. Vai su **Supabase Dashboard** > **Edge Functions** > **stripe-webhook** > **Logs**
2. Cerca errori che iniziano con `[STRIPE WEBHOOK] Error updating booking:`
3. Leggi il messaggio di errore

**Soluzione:**
- Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia configurato correttamente
- Il service role key dovrebbe bypassare RLS automaticamente
- Se ci sono vincoli, verifica che i valori siano validi

## Checklist di Diagnostica

Segui questa checklist in ordine:

```
□ 1. Verifica che il pagamento sia completato su Stripe
   → Dashboard Stripe > Payments > [Il tuo pagamento] > Status = "Succeeded"

□ 2. Verifica che il webhook sia stato chiamato
   → Dashboard Stripe > Developers > Webhooks > [Tuo endpoint] > Recent deliveries
   → Cerca l'evento checkout.session.completed con timestamp dopo il pagamento

□ 3. Se il webhook è presente, controlla lo stato:
   → Se "Succeeded (200)": Il webhook è stato processato, controlla i log
   → Se "Failed": Leggi il messaggio di errore nella sezione Response

□ 4. Controlla i log del webhook in Supabase
   → Supabase Dashboard > Edge Functions > stripe-webhook > Logs
   → Cerca messaggi che iniziano con [STRIPE WEBHOOK]
   → Verifica se ci sono errori

□ 5. Verifica il payment_status nella sessione Stripe
   → Dashboard Stripe > Checkout Sessions > [La tua sessione]
   → Verifica che Payment status = "paid"

□ 6. Verifica i metadati della sessione
   → Dashboard Stripe > Checkout Sessions > [La tua sessione] > Metadata
   → Verifica che ci sia "booking_id" con un valore valido

□ 7. Verifica che il booking_id esista nel database
   → Supabase > SQL Editor
   → Esegui: SELECT id, cart, status, stripe_checkout_session_id FROM bookings WHERE id = 'booking-id-dai-metadati';

□ 8. Verifica le variabili d'ambiente
   → Supabase > Project Settings > Edge Functions > Secrets
   → Verifica che STRIPE_WEBHOOK_SECRET sia presente e corretto
   → Verifica che SUPABASE_SERVICE_ROLE_KEY sia presente (dovrebbe essere automatico)

□ 9. Testa manualmente il webhook
   → Dashboard Stripe > Developers > Webhooks > [Tuo endpoint] > Send test webhook
   → Seleziona checkout.session.completed e invia
   → Controlla i log per vedere se viene processato
```

## Log Aggiunti per Debug

Ho aggiunto logging dettagliato nel webhook per aiutare a diagnosticare il problema:

- `[STRIPE WEBHOOK] checkout.session.completed event received`
- `[STRIPE WEBHOOK] Session ID: ...`
- `[STRIPE WEBHOOK] Payment status: ...`
- `[STRIPE WEBHOOK] Booking ID from metadata: ...`
- `[STRIPE WEBHOOK] Checking payment status: ...`
- `[STRIPE WEBHOOK] Payment is paid, proceeding with update`
- `[STRIPE WEBHOOK] Attempting to update booking: ...`
- `[STRIPE WEBHOOK] Update values: ...`
- `[STRIPE WEBHOOK] Booking updated successfully: ...`
- `[STRIPE WEBHOOK] Error updating booking: ...` (se c'è un errore)

## Come Vedere i Log

1. Vai su **Supabase Dashboard** > **Edge Functions** > **stripe-webhook**
2. Clicca su **Logs**
3. Filtra per timestamp recente
4. Cerca messaggi che iniziano con `[STRIPE WEBHOOK]`

## Soluzione Temporanea

Se il webhook continua a non funzionare, puoi aggiornare manualmente la prenotazione:

```sql
-- Trova la prenotazione per stripe_checkout_session_id
SELECT id, rifPrenotazione, cart, status, stripe_checkout_session_id
FROM bookings
WHERE stripe_checkout_session_id = 'cs_test_...';

-- Aggiorna manualmente (sostituisci 'uuid-prenotazione' con l'ID reale)
UPDATE bookings 
SET 
  cart = false,
  status = 'confirmed'
WHERE stripe_checkout_session_id = 'cs_test_...';
```

**⚠️ Nota:** Questa è solo una soluzione temporanea. Risolvi il problema del webhook per evitare di dover aggiornare manualmente ogni pagamento.

## Prossimi Passi

1. **Ridistribuisci** la funzione `stripe-webhook` con il nuovo logging
2. **Fai un pagamento di test**
3. **Controlla i log** per vedere cosa succede
4. **Segui la checklist** per identificare il problema
5. **Risolvi** il problema identificato





