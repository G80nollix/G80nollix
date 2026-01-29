# Come triggerare eventi Stripe con metadati usando la CLI

## Triggerare `payment_intent.succeeded` con metadati

### Metodo 1: Usando `--override` (Consigliato)

```bash
stripe trigger payment_intent.succeeded \
  --override payment_intent:metadata[booking_id]=<YOUR_BOOKING_ID>
```

**Esempio:**
```bash
stripe trigger payment_intent.succeeded \
  --override payment_intent:metadata[booking_id]=123e4567-e89b-12d3-a456-426614174000
```

### Metodo 2: Usando un file JSON

Crea un file `payment_intent_override.json`:

```json
{
  "payment_intent": {
    "metadata": {
      "booking_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  }
}
```

Poi esegui:
```bash
stripe trigger payment_intent.succeeded \
  --override payment_intent:@payment_intent_override.json
```

### Metodo 3: Override multipli

Puoi aggiungere più metadati o override:

```bash
stripe trigger payment_intent.succeeded \
  --override payment_intent:metadata[booking_id]=<YOUR_BOOKING_ID> \
  --override payment_intent:metadata[custom_field]=<VALUE> \
  --override payment_intent:amount=2000 \
  --override payment_intent:currency=eur
```

### Metodo 4: File JSON completo per override multipli

Crea `payment_intent_full_override.json`:

```json
{
  "payment_intent": {
    "id": "pi_test_1234567890",
    "amount": 2000,
    "currency": "eur",
    "status": "succeeded",
    "metadata": {
      "booking_id": "123e4567-e89b-12d3-a456-426614174000",
      "user_id": "user_123",
      "custom_field": "custom_value"
    }
  }
}
```

Poi:
```bash
stripe trigger payment_intent.succeeded \
  --override payment_intent:@payment_intent_full_override.json
```

## Inviare a un webhook locale

Se stai testando con un webhook locale (es. Supabase Functions):

```bash
# Prima avvia il listener locale
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# Poi in un altro terminale, triggera l'evento
stripe trigger payment_intent.succeeded \
  --override payment_intent:metadata[booking_id]=<YOUR_BOOKING_ID>
```

## Inviare a un webhook remoto

Se vuoi testare direttamente il webhook remoto:

```bash
stripe trigger payment_intent.succeeded \
  --override payment_intent:metadata[booking_id]=<YOUR_BOOKING_ID> \
  --webhook-endpoint <YOUR_WEBHOOK_ENDPOINT_ID>
```

## Note importanti

1. **booking_id è obbligatorio**: Il webhook restituirà un errore 400 se `booking_id` non è presente nei metadati
2. **Formato UUID**: Assicurati che il `booking_id` sia un UUID valido esistente nella tabella `bookings`
3. **Test locale**: Usa `stripe listen` per testare localmente prima di inviare a produzione
4. **Verifica signature**: Il webhook verifica la firma Stripe, quindi usa sempre la Stripe CLI o configura correttamente il webhook secret

## Esempio completo per test

```bash
# 1. Avvia il listener (in un terminale)
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# 2. In un altro terminale, triggera l'evento
stripe trigger payment_intent.succeeded \
  --override payment_intent:metadata[booking_id]=550e8400-e29b-41d4-a716-446655440000

# 3. Verifica i log del webhook per confermare che l'evento è stato processato
```


