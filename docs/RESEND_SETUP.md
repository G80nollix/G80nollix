# Configurazione Resend per l'invio delle email

## Problema Attuale
Il sistema di invio email di conferma durante la registrazione non funziona perché manca la configurazione della chiave API di Resend.

## Edge Functions Disponibili

### 1. `send-email` (Nuova - Generica)
- **Scopo**: Invio di email generiche con payload diretto
- **Utilizzi**:
  - Email di test
  - Email di conferma prenotazione (con template HTML completo)
  - Qualsiasi email personalizzata
- **Formato payload**:
  ```json
  {
    "to": "email@example.com",
    "from": "info@cirqlo.it",
    "subject": "Test Email - Nollix",
    "html": "Contenuto HTML dell'email"
  }
  ```
- **Parametri**:
  - `to`: Email destinatario (obbligatorio)
  - `from`: Email mittente (obbligatorio)
  - `subject`: Oggetto email (obbligatorio)
  - `html`: Contenuto HTML dell'email (obbligatorio)

### 2. `send-email` (Tutte le Email)
- **Scopo**: Invio email generiche con HTML personalizzato
- **Formato payload**:
  ```json
  {
    "to": "cliente@example.com",
    "subject": "Oggetto email",
    "html": "<html>...</html>"
  }
  ```
- **Parametri**:
  - `to`: Email destinatario (obbligatorio)
  - `subject`: Oggetto email (obbligatorio)
  - `html`: Contenuto HTML (obbligatorio)



## Soluzione

### 1. Ottenere una chiave API di Resend
1. Vai su [https://resend.com](https://resend.com)
2. Crea un account gratuito
3. Vai nella sezione "API Keys"
4. Crea una nuova chiave API
5. Copia la chiave API

### 2. Configurare la variabile d'ambiente in Supabase

#### Opzione A: Tramite Dashboard Supabase
1. Vai su [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su "Settings" > "Edge Functions"
4. Aggiungi la variabile d'ambiente:
   - **Nome**: `RESEND_API_KEY`
   - **Valore**: La tua chiave API di Resend

#### Opzione B: Tramite CLI Supabase
```bash
# Installa Supabase CLI se non l'hai già
npm install -g supabase

# Login a Supabase
supabase login

# Imposta la variabile d'ambiente
supabase secrets set RESEND_API_KEY=your_resend_api_key_here

# Deploy delle Edge Functions
supabase functions deploy send-email
```

### 3. Verificare la configurazione
Dopo aver configurato la chiave API, la funzione `send-email` dovrebbe funzionare correttamente.

### 4. Testare l'invio email
1. Vai su `/test` nella tua applicazione
2. Inserisci un'email di test
3. Clicca "Invia Email di Test"
4. Verifica che l'email arrivi
5. Prova a registrare un nuovo utente
6. Verifica che l'email di benvenuto venga inviata
7. Prova a creare una prenotazione
8. Verifica che l'email di conferma prenotazione venga inviata (usa `send-email`)
9. Controlla i log delle Edge Functions per eventuali errori

## Note Importanti
- La chiave API di Resend è sensibile, non condividerla mai
- Il piano gratuito di Resend permette 100 email al giorno
- Assicurati che il dominio di invio sia verificato in Resend

## Troubleshooting
Se continui ad avere problemi:
1. Verifica che la chiave API sia corretta
2. Controlla i log delle Edge Functions
3. Verifica che il dominio di invio sia configurato in Resend
4. Assicurati che l'account Resend sia attivo 