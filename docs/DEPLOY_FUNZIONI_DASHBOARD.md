# Guida: Come Deployare le Funzioni dalla Dashboard Supabase

Questa guida ti spiega passo-passo come deployare tutte le Edge Functions di Supabase direttamente dalla dashboard web, senza utilizzare la CLI.

## 📋 Funzioni Disponibili

Il progetto include le seguenti Edge Functions:

1. **`send-email`** - Invio email generiche tramite Resend
2. **`create-customer-account`** - Creazione account cliente con email di benvenuto
3. **`create-stripe-checkout`** - Creazione sessione di pagamento Stripe
4. **`stripe-webhook`** - Gestione webhook di Stripe per conferma pagamenti
5. **`send-welcome-email-self-registration`** - Email di benvenuto per auto-registrazione (se presente)

---

## 🚀 Procedura di Deploy

### Passo 1: Accedi alla Dashboard Supabase

1. Vai su [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Effettua il login con le tue credenziali
3. Seleziona il tuo progetto (es. `hxmaicqeywynupwktddo`)

### Passo 2: Accedi alla Sezione Edge Functions

1. Nel menu laterale sinistro, clicca su **Edge Functions**
2. Verrai portato alla pagina di gestione delle funzioni

### Passo 3: Deploy di una Nuova Funzione

Per ogni funzione che vuoi deployare, segui questi passaggi:

#### Opzione A: Funzione Non Esistente (Prima Volta)

1. Clicca sul pulsante **"Deploy a new function"** o **"New function"**
2. Inserisci il nome della funzione (es. `send-email`, `create-customer-account`, ecc.)
3. Si aprirà l'editor di codice
4. **Copia tutto il contenuto** del file corrispondente da:
   ```
   supabase/functions/[nome-funzione]/index.ts
   ```
5. **Incolla** il codice nell'editor della dashboard
6. Clicca su **"Deploy"** o **"Save"** per salvare e deployare

#### Opzione B: Funzione Già Esistente (Aggiornamento)

1. Nella lista delle funzioni, trova quella che vuoi aggiornare
2. Clicca sui **tre puntini (...)** accanto alla funzione
3. Seleziona **"Edit"** o **"Modifica"**
4. Si aprirà l'editor di codice con il codice attuale
5. **Sostituisci tutto il contenuto** con il nuovo codice dal file locale
6. Clicca su **"Deploy"** o **"Save"** per salvare le modifiche

---

## 📝 Deploy Dettagliato per Ogni Funzione

### 1. `send-email`

**File da copiare:** `supabase/functions/send-email/index.ts`

**Descrizione:** Funzione per inviare email generiche tramite Resend API.

**Variabili d'ambiente richieste:**
- `RESEND_API_KEY` - Chiave API di Resend

**Come deployare:**
1. Vai su Edge Functions nella dashboard
2. Clicca "Deploy a new function" (o modifica se esiste già)
3. Nome: `send-email`
4. Copia tutto il contenuto da `supabase/functions/send-email/index.ts`
5. Incolla nell'editor
6. Clicca "Deploy"

---

### 2. `create-customer-account`

**File da copiare:** `supabase/functions/create-customer-account/index.ts`

**Descrizione:** Crea un account cliente nel sistema e invia email di benvenuto.

**Variabili d'ambiente richieste:**
- `SUPABASE_URL` - URL del progetto Supabase (automatico)
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key (automatico)

**Come deployare:**
1. Vai su Edge Functions nella dashboard
2. Clicca "Deploy a new function" (o modifica se esiste già)
3. Nome: `create-customer-account`
4. Copia tutto il contenuto da `supabase/functions/create-customer-account/index.ts`
5. Incolla nell'editor
6. Clicca "Deploy"

---

### 3. `create-stripe-checkout`

**File da copiare:** `supabase/functions/create-stripe-checkout/index.ts`

**Descrizione:** Crea una sessione di checkout Stripe per il pagamento delle prenotazioni.

**Variabili d'ambiente richieste:**
- `STRIPE_SECRET_KEY` - Chiave segreta di Stripe (sk_test_... o sk_live_...)
- `SITE_URL` - URL del sito (es. `https://demo.nollix.it`)
- `SUPABASE_URL` - URL del progetto Supabase (automatico)
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key (automatico)

**Come deployare:**
1. Vai su Edge Functions nella dashboard
2. Clicca "Deploy a new function" (o modifica se esiste già)
3. Nome: `create-stripe-checkout`
4. Copia tutto il contenuto da `supabase/functions/create-stripe-checkout/index.ts`
5. Incolla nell'editor
6. Clicca "Deploy"

---

### 4. `stripe-webhook`

**File da copiare:** `supabase/functions/stripe-webhook/index.ts`

**Descrizione:** Gestisce i webhook di Stripe per confermare le prenotazioni dopo il pagamento.

**Variabili d'ambiente richieste:**
- `STRIPE_WEBHOOK_SECRET` - Secret del webhook Stripe (whsec_...)
- `SUPABASE_URL` - URL del progetto Supabase (automatico)
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key (automatico)

**Come deployare:**
1. Vai su Edge Functions nella dashboard
2. Clicca "Deploy a new function" (o modifica se esiste già)
3. Nome: `stripe-webhook`
4. Copia tutto il contenuto da `supabase/functions/stripe-webhook/index.ts`
5. Incolla nell'editor
6. Clicca "Deploy"

---

### 5. `send-welcome-email-self-registration` (se presente)

**File da copiare:** `supabase/functions/send-welcome-email-self-registration/index.ts`

**Descrizione:** Invia email di benvenuto quando un utente si registra autonomamente.

**Variabili d'ambiente richieste:**
- `RESEND_API_KEY` - Chiave API di Resend

**Come deployare:**
1. Vai su Edge Functions nella dashboard
2. Clicca "Deploy a new function" (o modifica se esiste già)
3. Nome: `send-welcome-email-self-registration`
4. Copia tutto il contenuto dal file corrispondente
5. Incolla nell'editor
6. Clicca "Deploy"

---

## ⚙️ Configurazione Variabili d'Ambiente

Prima di deployare le funzioni, assicurati di aver configurato tutte le variabili d'ambiente necessarie:

### Come Aggiungere Variabili d'Ambiente

1. Nella dashboard Supabase, vai su **Settings** (Impostazioni)
2. Nel menu laterale, clicca su **Edge Functions**
3. Vai alla sezione **Secrets** o **Environment Variables**
4. Clicca su **"Add new secret"** o **"Aggiungi nuova variabile"**
5. Inserisci:
   - **Nome:** (es. `RESEND_API_KEY`)
   - **Valore:** (il valore della variabile)
6. Clicca su **"Save"** o **"Salva"**

### Variabili Richieste

Assicurati di avere configurate queste variabili:

| Variabile | Descrizione | Dove Ottenerla |
|-----------|-------------|----------------|
| `RESEND_API_KEY` | Chiave API di Resend | [resend.com](https://resend.com) → API Keys |
| `STRIPE_SECRET_KEY` | Chiave segreta Stripe | [stripe.com](https://stripe.com) → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook Stripe | [stripe.com](https://stripe.com) → Developers → Webhooks → Endpoint → Signing secret |
| `SITE_URL` | URL del sito web | Il tuo dominio (es. `https://demo.nollix.it`) |

**Nota:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono automaticamente disponibili nelle Edge Functions, non serve configurarle manualmente.

---

## ✅ Verifica del Deploy

Dopo aver deployato una funzione, puoi verificare che funzioni correttamente:

1. Nella pagina **Edge Functions**, vedrai la funzione nella lista
2. Clicca sulla funzione per vedere i dettagli
3. Vai alla sezione **"Logs"** per vedere i log in tempo reale
4. Puoi testare la funzione usando l'opzione **"Invoke"** o **"Test"**

### Test di una Funzione

1. Clicca sulla funzione che vuoi testare
2. Clicca su **"Invoke"** o **"Test"**
3. Inserisci un payload JSON di esempio
4. Clicca su **"Run"** o **"Esegui"**
5. Controlla la risposta e i log

---

## 🔄 Aggiornare una Funzione Esistente

Quando modifichi una funzione localmente e vuoi aggiornarla nella dashboard:

1. Apri il file modificato: `supabase/functions/[nome-funzione]/index.ts`
2. Seleziona tutto il contenuto (Ctrl+A / Cmd+A)
3. Copia (Ctrl+C / Cmd+C)
4. Vai alla dashboard Supabase → Edge Functions
5. Trova la funzione e clicca sui tre puntini (...)
6. Seleziona **"Edit"**
7. Seleziona tutto il codice nell'editor (Ctrl+A / Cmd+A)
8. Incolla il nuovo codice (Ctrl+V / Cmd+V)
9. Clicca su **"Deploy"** o **"Save"**

---

## 🐛 Risoluzione Problemi

### La funzione non si deploya

- **Problema:** Errore durante il deploy
- **Soluzione:** 
  - Controlla che il codice sia completo (non mancano parti)
  - Verifica che non ci siano errori di sintassi
  - Controlla i log nella dashboard per dettagli sull'errore

### La funzione non funziona dopo il deploy

- **Problema:** La funzione restituisce errori quando viene chiamata
- **Soluzione:**
  - Verifica che tutte le variabili d'ambiente siano configurate
  - Controlla i log della funzione nella dashboard
  - Verifica che le dipendenze (import) siano corrette

### Errore "RESEND_API_KEY not configured"

- **Problema:** La funzione `send-email` non trova la chiave API
- **Soluzione:**
  1. Vai su Settings → Edge Functions → Secrets
  2. Verifica che `RESEND_API_KEY` sia presente
  3. Se manca, aggiungila con il valore corretto

### Errore "STRIPE_SECRET_KEY not found"

- **Problema:** La funzione Stripe non trova la chiave
- **Soluzione:**
  1. Vai su Settings → Edge Functions → Secrets
  2. Aggiungi `STRIPE_SECRET_KEY` con la tua chiave Stripe
  3. Per test, usa `sk_test_...`
  4. Per produzione, usa `sk_live_...`

---

## 📚 Risorse Utili

- [Documentazione Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Dashboard Supabase](https://supabase.com/dashboard)
- [Documentazione Resend](https://resend.com/docs)
- [Documentazione Stripe](https://stripe.com/docs)

---

## 💡 Suggerimenti

1. **Deploy in ordine:** Deploya prima `send-email`, poi le altre funzioni che la utilizzano
2. **Test dopo ogni deploy:** Testa ogni funzione dopo il deploy per assicurarti che funzioni
3. **Backup del codice:** Prima di modificare una funzione esistente, copia il codice attuale come backup
4. **Log attivi:** Tieni sempre i log aperti durante i test per vedere eventuali errori in tempo reale
5. **Variabili d'ambiente:** Configura tutte le variabili d'ambiente prima di deployare le funzioni che le utilizzano

---

## 🎯 Checklist Completa

Prima di considerare il deploy completo, verifica:

- [ ] Tutte le funzioni sono deployate
- [ ] Tutte le variabili d'ambiente sono configurate
- [ ] `send-email` funziona e può inviare email
- [ ] `create-customer-account` crea account correttamente
- [ ] `create-stripe-checkout` crea sessioni di pagamento
- [ ] `stripe-webhook` riceve e processa gli eventi Stripe
- [ ] I log non mostrano errori critici
- [ ] Le funzioni rispondono correttamente ai test

---

**Ultimo aggiornamento:** Gennaio 2025




