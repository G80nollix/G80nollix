# Workflow Completo del Pagamento Stripe

Questo documento descrive il flusso completo del pagamento dal checkout alla conferma e invio email.

## 📋 Panoramica del Flusso

```
1. Utente nel Carrello
   ↓
2. Clicca "Paga"
   ↓
3. Frontend chiama create-stripe-checkout
   ↓
4. Edge Function crea Stripe Checkout Session
   ↓
5. Utente reindirizzato a Stripe
   ↓
6. Utente completa il pagamento
   ↓
7. Stripe reindirizza a /booking-confirmation
   ↓
8. Stripe chiama webhook (in parallelo)
   ↓
9. Webhook aggiorna database e invia email
   ↓
10. Utente vede pagina di conferma
```

---

## 🔄 Dettaglio Passo-Passo

### **FASE 1: Inizio del Checkout (Frontend)**

**File:** `src/pages/Cart.tsx`

**Codice:**
```typescript
// Utente clicca "Paga"
const stripeCheckoutMutation = useMutation({
  mutationFn: async (bookingId: string) => {
    // Chiama la Edge Function
    const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
      method: 'POST',
      body: { bookingId },
    });

    if (error) throw error;
    if (!data?.checkoutUrl) {
      throw new Error('URL di checkout non ricevuto');
    }

    // Reindirizza a Stripe
    window.location.href = data.checkoutUrl;
  },
});
```

**Cosa succede:**
- L'utente clicca il pulsante "Paga" nel carrello
- Il frontend chiama la Edge Function `create-stripe-checkout`
- Passa il `bookingId` della prenotazione nel carrello
- Riceve l'URL della checkout session Stripe
- Reindirizza automaticamente l'utente a Stripe

---

### **FASE 2: Creazione Stripe Checkout Session**

**File:** `supabase/functions/create-stripe-checkout/index.ts`

**Cosa fa la funzione:**

1. **Riceve il bookingId** dal frontend

2. **Recupera i dati della prenotazione:**
   - Dettagli della prenotazione (prodotti, date, prezzi)
   - Email dell'utente
   - Verifica che la prenotazione sia nel carrello (`cart = true`)

3. **Costruisce i line items per Stripe:**
   ```typescript
   // Per ogni prodotto nel carrello
   bodyParams.append(`line_items[${index}][price_data][currency]`, 'eur');
   bodyParams.append(`line_items[${index}][price_data][product_data][name]`, `${productName} (${startDate} - ${endDate})`);
   bodyParams.append(`line_items[${index}][price_data][unit_amount]`, unitAmount.toString());
   ```

4. **Configura gli URL di successo e cancellazione:**
   ```typescript
   const successUrl = `${baseUrl}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`;
   const cancelUrl = `${baseUrl}/cart?canceled=true`;
   ```

5. **Aggiunge metadati alla sessione:**
   ```typescript
   bodyParams.append('metadata[booking_id]', bookingId);
   bodyParams.append('metadata[user_id]', booking.user_id);
   ```
   *Questi metadati sono cruciali per il webhook!*

6. **Crea la Stripe Checkout Session:**
   ```typescript
   const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${stripeSecretKey}`,
       'Content-Type': 'application/x-www-form-urlencoded',
     },
     body: bodyParams.toString(),
   });
   ```

7. **Salva lo stripe_checkout_session_id nel database:**
   ```typescript
   await supabaseAdmin
     .from('bookings')
     .update({ stripe_checkout_session_id: checkoutSession.id })
     .eq('id', bookingId);
   ```
   *Questo permette di tracciare la prenotazione anche se il webhook fallisce*

8. **Restituisce l'URL della checkout session:**
   ```typescript
   return {
     success: true,
     checkoutUrl: checkoutSession.url,
     sessionId: checkoutSession.id,
   };
   ```

**Risultato:**
- Stripe Checkout Session creata
- `stripe_checkout_session_id` salvato nel database
- Utente reindirizzato a Stripe per pagare

---

### **FASE 3: Pagamento su Stripe (Hosted Checkout)**

**Dove:** Stripe Dashboard (pagina esterna)

**Cosa succede:**
- L'utente vede la pagina di pagamento Stripe
- Inserisce i dati della carta
- Completa il pagamento
- Stripe processa il pagamento

**Dopo il pagamento:**
- Stripe reindirizza automaticamente l'utente a:
  ```
  /booking-confirmation?session_id=cs_test_abc123...
  ```

---

### **FASE 4: Reindirizzamento a BookingConfirmation**

**File:** `src/pages/BookingConfirmation.tsx`

**Cosa succede:**

1. **La pagina viene caricata** con il parametro `session_id`

2. **Recupera i dati della prenotazione:**
   ```typescript
   const { data: bookingData } = useQuery({
     queryKey: ["booking-confirmation", sessionId],
     queryFn: async () => {
       // Cerca la prenotazione usando stripe_checkout_session_id
       const { data: booking } = await supabase
         .from("bookings")
         .select("rifPrenotazione, status, cart")
         .eq("stripe_checkout_session_id", sessionId)
         .eq("user_id", user.id)
         .single();
       
       return booking;
     },
   });
   ```

3. **Mostra il codice di conferma:**
   - Se il webhook ha già processato: mostra `rifPrenotazione`
   - Se il webhook è ancora in elaborazione: mostra "Caricamento..."

**Nota:** Il webhook viene chiamato in parallelo, quindi potrebbe essere ancora in elaborazione quando l'utente arriva sulla pagina.

---

### **FASE 5: Webhook Stripe (Processamento Automatico)**

**File:** `supabase/functions/stripe-webhook/index.ts`

**Quando:** Stripe chiama automaticamente il webhook dopo il pagamento

**URL del webhook:**
```
https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook?apikey=[ANON_KEY]
```

**Cosa fa il webhook:**

#### 5.1 Verifica della Firma
```typescript
// Verifica che la richiesta provenga da Stripe
const isValid = await verifyStripeSignature(body, signature, stripeWebhookSecret);
if (!isValid) {
  return error 401;
}
```

#### 5.2 Parsing dell'Evento
```typescript
// Stripe invia un evento checkout.session.completed
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const bookingId = session.metadata?.booking_id; // Dal FASE 2, punto 5
}
```

#### 5.3 Verifica del Pagamento
```typescript
// Aggiorna solo se il pagamento è stato completato
if (session.payment_status === 'paid') {
  // Procedi con l'aggiornamento
}
```

#### 5.4 Aggiornamento del Database
```typescript
// Aggiorna la prenotazione
await supabaseAdmin
  .from('bookings')
  .update({ 
    cart: false,              // Rimuove dal carrello
    status: 'confirmed',     // Conferma la prenotazione
    stripe_checkout_session_id: session.id, // Salva l'ID (già salvato, ma lo aggiorna)
  })
  .eq('id', bookingId);
```

**Risultato nel database:**
- ✅ `cart = false` (carrello svuotato)
- ✅ `status = 'confirmed'` (prenotazione confermata)
- ✅ `stripe_checkout_session_id` salvato

#### 5.5 Invio Email di Conferma

**Recupera i dati per l'email:**
```typescript
// Profilo utente
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('email, first_name, last_name')
  .eq('id', booking.user_id)
  .single();

// Dettagli prenotazione
const { data: bookingDetails } = await supabaseAdmin
  .from('booking_details')
  .select(`
    id, price, start_date, end_date,
    product_units!inner(
      product_variants!inner(
        products!inner(name)
      )
    )
  `)
  .eq('booking_id', bookingId);
```

**Costruisce l'email HTML:**
- Template HTML con stile
- Lista prodotti prenotati
- Date di inizio/fine
- Prezzo totale
- Riferimento prenotazione (`rifPrenotazione`)

**Invia l'email:**
```typescript
await supabaseAdmin.functions.invoke('send-email', {
  method: 'POST',
  body: {
    to: userEmail,
    subject: 'Prenotazione Confermata - Pagamento Completato',
    html: emailHtml,
  },
});
```

**Risultato:**
- ✅ Email inviata al cliente con tutti i dettagli
- ✅ Cliente riceve conferma del pagamento

---

## 📊 Diagramma del Flusso

```
┌─────────────────┐
│   CARRELLO      │
│  (Cart.tsx)     │
└────────┬────────┘
         │
         │ 1. Clicca "Paga"
         │    POST /functions/v1/create-stripe-checkout
         ▼
┌─────────────────────────────┐
│ create-stripe-checkout      │
│ (Edge Function)             │
│                             │
│ • Recupera booking details  │
│ • Crea Stripe Session       │
│ • Salva session_id nel DB   │
│ • Restituisce checkoutUrl   │
└────────┬────────────────────┘
         │
         │ 2. window.location.href = checkoutUrl
         ▼
┌─────────────────┐
│   STRIPE.COM    │
│  (Hosted Page)  │
│                 │
│ • Pagamento     │
│ • Processamento │
└────────┬────────┘
         │
         │ 3a. Reindirizza utente
         │     /booking-confirmation?session_id=...
         │
         │ 3b. Chiama webhook (in parallelo)
         │     POST /functions/v1/stripe-webhook
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────────────────┐  ┌──────────────────────┐
│ BookingConfirmation│  │ stripe-webhook       │
│ (Frontend)       │  │ (Edge Function)      │
│                  │  │                      │
│ • Mostra pagina  │  │ • Verifica firma     │
│ • Recupera rif   │  │ • Aggiorna DB        │
│ • Mostra codice  │  │   - cart = false     │
│                  │  │   - status = confirmed│
│                  │  │ • Invia email        │
└──────────────────┘  └──────────────────────┘
```

---

## 🔑 Punti Chiave

### Metadati Cruciali
I metadati aggiunti in **FASE 2** sono essenziali:
- `metadata[booking_id]`: Permette al webhook di trovare la prenotazione
- `metadata[user_id]`: Utile per verifiche aggiuntive

### Timing
- Il webhook viene chiamato **in parallelo** al reindirizzamento
- L'utente potrebbe arrivare su `/booking-confirmation` prima che il webhook finisca
- La pagina gestisce questo caso mostrando "Caricamento..." se necessario

### Sicurezza
- Il webhook verifica la firma Stripe per garantire autenticità
- Usa `SUPABASE_SERVICE_ROLE_KEY` per bypassare RLS
- I metadati sono crittografati da Stripe

### Resilienza
- `stripe_checkout_session_id` viene salvato subito (FASE 2)
- Anche se il webhook fallisce, la prenotazione è tracciabile
- Il webhook può essere richiamato da Stripe in caso di errore

---

## 📧 Dettagli Email

**Destinatario:** Email dell'utente dal profilo

**Oggetto:** `Prenotazione Confermata - Pagamento Completato`

**Contenuto:**
- Header con logo e titolo
- Saluto personalizzato (nome utente)
- Lista prodotti prenotati con:
  - Nome prodotto
  - Date di inizio/fine
  - Prezzo
- Box con prezzo totale pagato
- Footer con informazioni

**Template:** HTML responsive con stile inline

---

## ✅ Checklist Finale

Dopo il pagamento completo:

- [x] Stripe Checkout Session creata
- [x] `stripe_checkout_session_id` salvato nel database
- [x] Utente reindirizzato a `/booking-confirmation`
- [x] Webhook chiamato da Stripe
- [x] Firma webhook verificata
- [x] Database aggiornato:
  - [x] `cart = false`
  - [x] `status = 'confirmed'`
- [x] Email inviata al cliente
- [x] Cliente vede pagina di conferma con codice

---

## 🐛 Troubleshooting

### Se il webhook non viene chiamato
- Verifica l'URL del webhook in Stripe Dashboard
- Verifica che l'evento `checkout.session.completed` sia selezionato
- Controlla i log in Stripe Dashboard > Webhooks > Recent deliveries

### Se il database non viene aggiornato
- Controlla i log del webhook in Supabase
- Verifica che `STRIPE_WEBHOOK_SECRET` sia configurato
- Verifica che `payment_status === 'paid'`

### Se l'email non viene inviata
- Controlla i log della funzione `send-email`
- Verifica che `RESEND_API_KEY` sia configurato
- L'errore email non blocca il webhook (non fallisce se l'email fallisce)

---

## 📝 Note Tecniche

- **Edge Functions** usano Deno runtime
- **Service Role Key** bypassa RLS per aggiornamenti amministrativi
- **Stripe Webhook** può essere richiamato più volte (idempotenza)
- **React Query** gestisce il caching e il refetch dei dati

