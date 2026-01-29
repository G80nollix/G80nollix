# Configurazione Stripe per Nollix

Questa guida spiega come configurare l'integrazione Stripe per il pagamento delle prenotazioni.

## Prerequisiti

1. Account Stripe (https://stripe.com)
2. Accesso al dashboard Supabase per configurare le variabili d'ambiente

## Passaggi di Configurazione

### 1. Ottenere le Chiavi API Stripe

1. Accedi al tuo account Stripe: https://dashboard.stripe.com
2. Vai su **Developers** > **API keys**
3. Copia le seguenti chiavi:
   - **Publishable key** (per il frontend, se necessario in futuro)
   - **Secret key** (per il backend)
   - **Webhook signing secret** (dopo aver configurato il webhook)

### 2. Configurare le Variabili d'Ambiente in Supabase

1. Vai al tuo progetto Supabase: https://supabase.com/dashboard
2. Vai su **Project Settings** > **Edge Functions** > **Secrets**
3. Aggiungi le seguenti variabili d'ambiente:

   ```
   STRIPE_SECRET_KEY=sk_test_... (o sk_live_... per produzione)
   STRIPE_WEBHOOK_SECRET=whsec_... (dopo aver configurato il webhook)
   SITE_URL=https://demo.nollix.it (o il tuo dominio)
   ```

### 3. Configurare il Webhook Stripe

#### Come trovare il PROJECT_REF

Il `PROJECT_REF` è l'identificatore univoco del tuo progetto Supabase. Puoi trovarlo in diversi modi:

1. **Dal Dashboard Supabase:**
   - Vai su https://supabase.com/dashboard
   - Seleziona il tuo progetto
   - Vai su **Project Settings** > **General**
   - Il **Reference ID** è il tuo PROJECT_REF

2. **Dal file di configurazione del progetto:**
   - Apri `supabase/config.toml`
   - Cerca `project_id` (es: `project_id = "hxmaicqeywynupwktddo"`)

3. **Dall'URL Supabase:**
   - Se conosci l'URL del tuo progetto Supabase (es: `https://hxmaicqeywynupwktddo.supabase.co`)
   - Il PROJECT_REF è la parte prima di `.supabase.co`

#### Configurazione del Webhook

1. Nel dashboard Stripe, vai su **Developers** > **Webhooks**
2. Clicca su **Add endpoint**
3. **Ottieni la chiave API (anon key) da Supabase:**
   - Vai su Supabase Dashboard > Project Settings > API
   - Copia la **anon/public key** (la chiave che inizia con `eyJ...`)
4. Inserisci l'URL del webhook **con la chiave API**:
   ```
   https://hxmaicqeywynupwktddo.supabase.co/functions/v1/stripe-webhook?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   *(Sostituisci `hxmaicqeywynupwktddo` con il tuo PROJECT_REF e `eyJ...` con la tua anon key)*
   
   **⚠️ Importante:** L'URL deve includere `?apikey=...` per autenticare le richieste di Stripe. Senza questo parametro, riceverai errori `401 Unauthorized`.
   
   **Se hai già configurato il webhook senza la chiave API:**
   - Vai su **Developers** > **Webhooks**
   - Clicca sul tuo endpoint esistente
   - Clicca su **"Modifica"** o **"Edit"** (o l'icona a forma di matita)
   - Aggiorna l'URL aggiungendo `?apikey=eyJ...` alla fine
   - Salva le modifiche
5. Seleziona gli eventi da ascoltare:
   - `checkout.session.completed`
6. Clicca su **Add endpoint**
7. Copia il **Signing secret** (inizia con `whsec_`) e aggiungilo alle variabili d'ambiente in Supabase con il nome:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
   *(Vai su **Project Settings** > **Edge Functions** > **Secrets** e aggiungi questa variabile)*

### 4. Eseguire la Migrazione del Database

La migrazione aggiunge il campo `stripe_checkout_session_id` alla tabella `bookings`:

**Opzione 1: Dal Dashboard Supabase (Consigliato)**

1. Vai su https://supabase.com/dashboard
2. Seleziona il tuo progetto
3. Vai su **SQL Editor** (nel menu laterale)
4. Clicca su **New query**
5. Incolla il seguente SQL:

```sql
-- Aggiungi campo per tracciare la Stripe Checkout Session
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Aggiungi indice per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_checkout_session_id 
ON public.bookings(stripe_checkout_session_id);
```

6. Clicca su **Run** (o premi `Ctrl+Enter`)

**Opzione 2: Tramite Supabase CLI**

Se hai Supabase CLI installato e configurato:

```bash
# Assicurati di essere linkato al progetto
supabase link --project-ref hxmaicqeywynupwktddo

# Esegui la migrazione
supabase db push
```

Il file di migrazione si trova in: `supabase/migrations/20250120000000-add-stripe-fields.sql`

### 5. Deploy delle Edge Functions

**Opzione 1: Dal Dashboard Supabase (Consigliato) - Copia e Incolla**

#### Deploy di `create-stripe-checkout`:

1. **Apri il file del codice:**
   - Apri il file `supabase/functions/create-stripe-checkout/index.ts` nel tuo editor
   - Oppure apri il file `create-stripe-checkout-CODICE-COMPLETO.txt` che contiene tutto il codice pronto

2. **Copia tutto il codice:**
   - Seleziona tutto il contenuto (Ctrl+A / Cmd+A)
   - Copia (Ctrl+C / Cmd+C)

3. **Vai alla Dashboard Supabase:**
   - Apri https://supabase.com/dashboard
   - Seleziona il tuo progetto
   - Nel menu laterale, clicca su **Edge Functions**

4. **Crea o modifica la funzione:**
   - **Se la funzione NON esiste ancora:**
     - Clicca su **"Deploy a new function"** o **"New function"**
     - Inserisci il nome: `create-stripe-checkout`
     - Si aprirà l'editor di codice
   - **Se la funzione ESISTE già:**
     - Trova `create-stripe-checkout` nella lista
     - Clicca sui **tre puntini (...)** accanto alla funzione
     - Seleziona **"Edit"** o **"Modifica"**
     - Si aprirà l'editor con il codice attuale

5. **Incolla il codice:**
   - Seleziona tutto il codice nell'editor della dashboard (Ctrl+A / Cmd+A)
   - Elimina il contenuto esistente (Delete)
   - Incolla il codice copiato (Ctrl+V / Cmd+V)

6. **Salva e deploya:**
   - Clicca su **"Deploy"** o **"Save"** (in alto a destra)
   - Attendi qualche secondo per il deploy
   - Vedrai un messaggio di conferma quando è completato

#### Deploy di `stripe-webhook`:

Ripeti gli stessi passaggi per `stripe-webhook`, usando il file `supabase/functions/stripe-webhook/index.ts`

**Opzione 2: Tramite Supabase CLI**

Se hai Supabase CLI installato e configurato:

```bash
# Dalla root del progetto
# Assicurati di essere autenticato
supabase login

# Link al progetto (se non già fatto)
supabase link --project-ref hxmaicqeywynupwktddo

# Deploy delle funzioni
supabase functions deploy create-stripe-checkout
supabase functions deploy stripe-webhook
```

**Nota**: Se riscontri errori di spazio su disco, usa l'Opzione 1 (Dashboard).

## Flusso del Pagamento

1. **Utente clicca "Paga"** nel carrello
2. **Frontend chiama** `create-stripe-checkout` Edge Function
3. **Edge Function crea** una Stripe Checkout Session e restituisce l'URL
4. **Utente viene reindirizzato** a Stripe per completare il pagamento
5. **Dopo il pagamento**, Stripe chiama il webhook `stripe-webhook`
6. **Webhook aggiorna** la prenotazione:
   - Imposta `cart = false`
   - Imposta `status = 'confirmed'`
   - Salva `stripe_checkout_session_id`
7. **Webhook invia** email di conferma all'utente
8. **Utente viene reindirizzato** a `/payment-success`

## Come Rintracciare un Pagamento su Stripe

Il campo `stripe_checkout_session_id` salvato nella tabella `bookings` ti permette di rintracciare facilmente qualsiasi pagamento nel dashboard Stripe. Ecco come fare:

### Metodo 1: Dal Dashboard Stripe (Interfaccia Web)

1. **Accedi al Dashboard Stripe:**
   - Vai su https://dashboard.stripe.com
   - Assicurati di essere nella modalità corretta (Test o Live)

2. **Cerca la Checkout Session:**
   - Nel menu in alto, clicca sulla barra di ricerca
   - Incolla il `stripe_checkout_session_id` (es: `cs_test_a1b2c3d4...`)
   - Premi Invio o clicca sul risultato

3. **Visualizza i Dettagli:**
   Una volta aperta la sessione, puoi vedere:
   - **Stato del pagamento** (paid, unpaid, etc.)
   - **Importo pagato**
   - **Metodo di pagamento** utilizzato
   - **Dettagli del cliente** (email, nome)
   - **Metadati** (incluso `booking_id` se configurato)
   - **Data e ora** del pagamento
   - **Link al pagamento** (Payment Intent)
   - **Eventi webhook** associati

4. **Accedi al Payment Intent:**
   - Dalla pagina della Checkout Session, puoi cliccare sul link al Payment Intent
   - Qui troverai dettagli ancora più approfonditi sul pagamento

### Metodo 2: Tramite API Stripe

Se vuoi verificare programmaticamente lo stato di un pagamento:

```typescript
// Esempio: Verifica stato pagamento tramite API
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function verifyPayment(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  
  console.log('Stato pagamento:', session.payment_status);
  console.log('Importo:', session.amount_total / 100, session.currency);
  console.log('Cliente:', session.customer_email);
  console.log('Booking ID:', session.metadata?.booking_id);
  
  return session;
}
```

### Metodo 3: Dal Database Supabase

Per trovare tutte le prenotazioni con un pagamento specifico o verificare lo stato:

```sql
-- Trova una prenotazione per session ID
SELECT 
  id,
  rifPrenotazione,
  status,
  cart,
  stripe_checkout_session_id,
  created_at
FROM bookings
WHERE stripe_checkout_session_id = 'cs_test_a1b2c3d4...';

-- Trova tutte le prenotazioni pagate (con session ID)
SELECT 
  id,
  rifPrenotazione,
  status,
  stripe_checkout_session_id,
  created_at
FROM bookings
WHERE stripe_checkout_session_id IS NOT NULL
  AND status = 'confirmed'
ORDER BY created_at DESC;
```

### Cosa Puoi Fare con il Session ID

1. **Verificare lo stato del pagamento** direttamente su Stripe
2. **Risolvere dispute** o problemi di pagamento
3. **Rimborsare** un pagamento (se necessario)
4. **Tracciare** il flusso completo del pagamento
5. **Debug** problemi di integrazione
6. **Generare report** e analisi dei pagamenti

### Esempio Pratico: Rintracciare un Pagamento

Supponiamo che un cliente ti contatti dicendo che ha pagato ma non ha ricevuto la conferma:

1. **Dal database Supabase:**
   - Cerca la prenotazione per email o nome cliente
   - Copia il `stripe_checkout_session_id` dalla prenotazione

2. **Nel Dashboard Stripe:**
   - Cerca il session ID
   - Verifica che il pagamento sia stato completato (`payment_status: paid`)
   - Controlla se il webhook è stato chiamato correttamente

3. **Se il pagamento è confermato ma la prenotazione no:**
   - Controlla i log del webhook in Stripe
   - Verifica i log delle Edge Functions in Supabase
   - Potresti dover aggiornare manualmente la prenotazione

### Link Utili

- **Dashboard Stripe:** https://dashboard.stripe.com
- **Documentazione Checkout Sessions:** https://stripe.com/docs/api/checkout/sessions
- **Log Webhook Stripe:** Dashboard > Developers > Webhooks > [Tuo endpoint] > Recent deliveries

## Test

### Modalità Test

1. Usa le chiavi di test di Stripe (`sk_test_...`)
2. Usa le carte di test di Stripe:

#### Carte per Pagamenti con Successo

| Numero Carta | Scenario | Note |
|-------------|----------|------|
| `4242 4242 4242 4242` | Pagamento standard riuscito | Carta Visa generica |
| `5555 5555 5555 4444` | Pagamento standard riuscito | Carta Mastercard generica |
| `5200 8282 8282 8210` | Pagamento standard riuscito | Carta Mastercard generica |
| `4000 0566 5566 5556` | Pagamento con 3D Secure | Richiede autenticazione 3D Secure |

**Dati comuni per tutte le carte:**
- **CVC:** Qualsiasi 3 cifre (es: `123`)
- **Data di scadenza:** Qualsiasi data futura (es: `12/25` o `12/2025`)
- **CAP:** Qualsiasi CAP valido (es: `12345`)

#### Carte per Pagamenti Falliti

| Numero Carta | Scenario | Risultato |
|-------------|----------|-----------|
| `4000 0000 0000 0002` | Carta rifiutata | Il pagamento viene rifiutato |
| `4000 0000 0000 9995` | Fondi insufficienti | Errore "insufficient_funds" |
| `4000 0000 0000 9987` | Carta scaduta | Errore "expired_card" |
| `4000 0000 0000 0069` | Carta bloccata | Errore "card_declined" |
| `4000 0000 0000 0127` | CVC errato | Errore "incorrect_cvc" (dopo 3 tentativi) |
| `4000 0000 0000 0119` | Elaborazione fallita | Errore "processing_error" |

#### Carte per Scenari Speciali

| Numero Carta | Scenario | Comportamento |
|-------------|----------|---------------|
| `4000 0025 0000 3155` | Richiede autenticazione 3D Secure | Pagamento riuscito dopo autenticazione |
| `4000 0027 6000 3184` | Richiede autenticazione 3D Secure (fallita) | Autenticazione fallita |
| `4000 0082 6000 3178` | Richiede autenticazione 3D Secure (abbandonata) | L'utente abbandona l'autenticazione |
| `4000 0000 0000 3220` | Richiede autenticazione 3D Secure 2 | Versione 2 di 3D Secure |

#### Esempi Pratici

**Test pagamento riuscito:**
```
Numero: 4242 4242 4242 4242
CVC: 123
Scadenza: 12/2025
```

**Test pagamento rifiutato:**
```
Numero: 4000 0000 0000 0002
CVC: 123
Scadenza: 12/2025
```

**Test con 3D Secure:**
```
Numero: 4000 0566 5566 5556
CVC: 123
Scadenza: 12/2025
(Verrai reindirizzato alla pagina di autenticazione 3D Secure)
```

**Nota:** Tutte queste carte funzionano solo in modalità **Test** di Stripe. In produzione, usa carte reali.

### Verifica del Webhook

1. Nel dashboard Stripe, vai su **Developers** > **Webhooks**
2. Clicca sul tuo endpoint
3. Vai su **Recent deliveries** per vedere gli eventi ricevuti
4. Verifica che gli eventi `checkout.session.completed` vengano ricevuti correttamente

## Produzione

Quando sei pronto per la produzione:

1. Passa alle chiavi live di Stripe (`sk_live_...`)
2. Aggiorna `SITE_URL` con il tuo dominio di produzione
3. Verifica che il webhook sia configurato correttamente
4. Testa con un pagamento reale di piccolo importo

## Troubleshooting

### Il webhook non viene chiamato

- Verifica che l'URL del webhook sia corretto
- Controlla che il webhook sia attivo nel dashboard Stripe
- Verifica i log delle Edge Functions in Supabase

### Il pagamento non conferma la prenotazione (cart e status non vengono aggiornati)

Se vedi che `stripe_checkout_session_id` viene aggiornato ma `cart` e `status` rimangono invariati, significa che il webhook non sta funzionando correttamente. Segui questi passaggi:

#### 1. Verifica che il Webhook sia stato chiamato

1. **Nel Dashboard Stripe:**
   - Vai su **Developers** > **Webhooks**
   - Clicca sul tuo endpoint webhook
   - Vai su **Recent deliveries**
   - Cerca l'evento `checkout.session.completed` relativo al pagamento
   - Controlla lo **stato** dell'evento:
     - ✅ **Succeeded (200)**: Il webhook è stato chiamato con successo
     - ❌ **Failed**: Il webhook ha fallito (vedi i dettagli dell'errore)
     - ⚠️ **Non presente**: Il webhook non è stato chiamato

#### 2. Se il Webhook non è stato chiamato

**Possibili cause:**
- Il webhook non è configurato correttamente
- L'URL del webhook è errato
- Il webhook è disattivato

**Soluzione:**
1. Verifica l'URL del webhook nel dashboard Stripe
2. Assicurati che sia nella modalità corretta (Test o Live)
3. Controlla che l'endpoint sia attivo (toggle verde)

#### 3. Se il Webhook è stato chiamato ma ha fallito

**Controlla i log in Stripe:**
1. Nel dashboard Stripe, apri l'evento webhook fallito
2. Leggi il messaggio di errore nella sezione **Response**
3. Controlla anche i **Request** per vedere cosa è stato inviato

**Errori comuni:**

**a) "401 ERR Unauthorized" (⚠️ PROBLEMA PIÙ COMUNE)**

Se vedi `401 ERR Unauthorized` nei tentativi di consegna del webhook, significa che Supabase sta rifiutando la richiesta di Stripe perché manca l'autenticazione.

**Causa:**
- Le Edge Functions di Supabase richiedono un header `Authorization` con la chiave API
- Stripe non invia automaticamente questo header quando chiama il webhook
- L'endpoint è protetto e rifiuta le richieste non autenticate

**Soluzione:**

1. **Verifica che l'URL del webhook includa la chiave API:**
   
   L'URL del webhook deve essere nel formato:
   ```
   https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook?apikey=[ANON_KEY]
   ```
   
   Oppure puoi configurare l'endpoint per accettare richieste senza autenticazione (sconsigliato per produzione).

2. **Come ottenere l'ANON_KEY:**
   - Vai su Supabase Dashboard > Project Settings > API
   - Copia la **anon/public key** (non la service_role_key!)
   - Aggiungila all'URL del webhook come parametro query: `?apikey=eyJ...`

3. **Aggiorna l'URL del webhook in Stripe:**
   - Vai su Stripe Dashboard > Developers > Webhooks
   - Clicca sul tuo endpoint
   - Clicca su **"Modifica"** o **"Edit"**
   - Aggiorna l'URL con la chiave API:
     ```
     https://hxmaicqeywynupwktddo.supabase.co/functions/v1/stripe-webhook?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```
   - Salva le modifiche

4. **Testa il webhook:**
   - Dopo aver aggiornato l'URL, fai un nuovo pagamento di test
   - Oppure clicca su **"Invia di nuovo"** (Send again) nell'evento fallito
   - Verifica che ora lo stato sia **"Succeeded (200)"**

5. **Alternativa: Disabilita l'autenticazione per questo endpoint (solo per test):**
   
   Se preferisci non usare la chiave API nell'URL, puoi modificare la funzione `stripe-webhook` per accettare richieste senza autenticazione. Tuttavia, questo è **meno sicuro** perché chiunque può chiamare l'endpoint. Per sicurezza, usa sempre la chiave API nell'URL.

**⚠️ Nota Importante:** 
- Usa sempre la **anon key** (non la service_role_key) nell'URL del webhook
- La service_role_key è solo per uso interno e non deve essere esposta pubblicamente
- Dopo aver aggiunto la chiave API all'URL, Stripe riproverà automaticamente a inviare gli eventi falliti

**Se continui a ricevere l'errore 401 dopo aver aggiunto la chiave API:**

1. **Verifica che l'URL sia corretto:**
   - Controlla che non ci siano spazi nell'URL
   - Verifica che la chiave API sia completa (inizia con `eyJ` e termina con `...`)
   - Assicurati che l'URL sia nel formato esatto:
     ```
     https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook?apikey=[ANON_KEY]
     ```
   - Non usare `&` o altri caratteri speciali

2. **Verifica la chiave API:**
   - Vai su Supabase Dashboard > Project Settings > API
   - Assicurati di copiare la **anon/public key** (non la service_role_key)
   - La chiave dovrebbe iniziare con `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Copia l'intera chiave (può essere molto lunga)

3. **Testa l'URL direttamente:**
   - Apri un nuovo tab nel browser
   - Incolla l'URL del webhook (senza il parametro apikey se vuoi testare)
   - Dovresti vedere una risposta JSON o un errore
   - Se vedi un errore 401, significa che l'endpoint richiede autenticazione

4. **Verifica i log di Supabase:**
   - Vai su Supabase Dashboard > Edge Functions > stripe-webhook > Logs
   - Controlla se ci sono richieste che arrivano all'endpoint
   - Se non vedi nessuna richiesta nei log, significa che Supabase sta rifiutando la richiesta prima che arrivi alla funzione

5. **Soluzione alternativa: Modifica la funzione per accettare richieste senza autenticazione:**
   
   Se il problema persiste, puoi modificare la funzione `stripe-webhook` per non richiedere autenticazione Supabase. La sicurezza sarà garantita dalla verifica della firma Stripe.
   
   **⚠️ ATTENZIONE:** Questa modifica richiede di aggiornare il codice della funzione. La sicurezza sarà basata sulla verifica della firma Stripe invece che sull'autenticazione Supabase.
   
   Per implementare questa soluzione, devi:
   - Modificare la funzione per verificare la firma Stripe usando `STRIPE_WEBHOOK_SECRET`
   - Rimuovere la dipendenza dall'autenticazione Supabase per questo endpoint
   - L'URL del webhook può essere senza il parametro `?apikey=...`
   
   **Nota:** Questa è una soluzione valida perché la sicurezza del webhook Stripe si basa sulla verifica della firma, non sull'autenticazione dell'endpoint.

6. **Verifica che il webhook sia nella modalità corretta:**
   - Assicurati che il webhook in Stripe sia nella stessa modalità (Test o Live) delle tue chiavi API
   - Se stai testando, usa le chiavi di test (`sk_test_...`)
   - Se sei in produzione, usa le chiavi live (`sk_live_...`)

**b) "booking_id mancante nei metadati"**
- **Causa:** I metadati non sono stati passati correttamente alla sessione
- **Verifica:** Controlla che `create-stripe-checkout` aggiunga i metadati (riga 192)
- **Soluzione:** Verifica che la funzione `create-stripe-checkout` sia deployata correttamente

**b) "Prenotazione non trovata"**
- **Causa:** Il `booking_id` nei metadati non corrisponde a nessuna prenotazione
- **Verifica:** Controlla i metadati della sessione Stripe e confronta con il database
- **Soluzione:** Verifica che il `booking_id` sia corretto

**c) "Errore nell'aggiornamento della prenotazione"**
- **Causa:** Errore nel database (permessi, constraint, etc.)
- **Verifica:** Controlla i log delle Edge Functions in Supabase
- **Soluzione:** Verifica i permessi RLS e i constraint della tabella `bookings`

#### 4. Controlla i Log delle Edge Functions in Supabase

1. Vai al dashboard Supabase
2. Vai su **Edge Functions** > **stripe-webhook**
3. Controlla i **Logs** per vedere eventuali errori
4. Cerca messaggi che iniziano con `[STRIPE WEBHOOK]`

#### 5. Verifica la Configurazione del Webhook

Assicurati che:
- ✅ `STRIPE_WEBHOOK_SECRET` sia configurato in Supabase (Edge Functions > Secrets)
- ✅ Il webhook sia configurato per ascoltare l'evento `checkout.session.completed`
- ✅ L'URL del webhook sia corretto: `https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook`

#### 6. Test Manuale del Webhook

Se necessario, puoi testare manualmente il webhook:

1. **Dal Dashboard Stripe:**
   - Vai su **Developers** > **Webhooks**
   - Clicca sul tuo endpoint
   - Clicca su **Send test webhook**
   - Seleziona l'evento `checkout.session.completed`
   - Invia il test

2. **Verifica i log** per vedere se il test è stato processato correttamente

#### 7. Soluzione Temporanea: Aggiornamento Manuale

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

#### 8. Verifica che il Payment Status sia "paid"

Il webhook aggiorna `cart` e `status` solo se `session.payment_status === 'paid'`. Verifica nel dashboard Stripe che il pagamento sia effettivamente completato e non in stato "unpaid" o "no_payment_required".

#### Checklist di Diagnostica Completa

Segui questa checklist in ordine:

```
□ 1. Verifica che il pagamento sia completato su Stripe
   → Dashboard Stripe > Payments > [Il tuo pagamento] > Status = "Succeeded"

□ 2. Verifica che il webhook sia stato chiamato
   → Dashboard Stripe > Developers > Webhooks > [Tuo endpoint] > Recent deliveries
   → Cerca l'evento checkout.session.completed con timestamp dopo il pagamento

□ 3. Se il webhook è presente, controlla lo stato:
   → Se "Succeeded (200)": Il webhook è stato processato, ma potrebbe esserci un errore nel codice
   → Se "Failed": Leggi il messaggio di errore nella sezione Response

□ 4. Controlla i metadati della sessione Stripe
   → Dashboard Stripe > Checkout Sessions > [La tua sessione] > Metadata
   → Verifica che ci sia "booking_id" con un valore valido

□ 5. Verifica che il booking_id esista nel database
   → Supabase > SQL Editor
   → Esegui: SELECT id FROM bookings WHERE id = 'booking-id-dai-metadati';

□ 6. Controlla i log delle Edge Functions
   → Supabase > Edge Functions > stripe-webhook > Logs
   → Cerca errori che iniziano con [STRIPE WEBHOOK]

□ 7. Verifica le variabili d'ambiente
   → Supabase > Project Settings > Edge Functions > Secrets
   → Verifica che STRIPE_WEBHOOK_SECRET sia presente e corretto

□ 8. Testa manualmente il webhook
   → Dashboard Stripe > Developers > Webhooks > [Tuo endpoint] > Send test webhook
   → Seleziona checkout.session.completed e invia
```

### Errore "Configurazione Stripe mancante"

- Verifica che `STRIPE_SECRET_KEY` sia configurato in Supabase
- Assicurati che le Edge Functions abbiano accesso alle variabili d'ambiente

## Note Importanti

- **Non committare mai** le chiavi API nel codice
- Usa sempre variabili d'ambiente per le chiavi sensibili
- In produzione, usa sempre le chiavi live di Stripe
- Monitora regolarmente i pagamenti nel dashboard Stripe

