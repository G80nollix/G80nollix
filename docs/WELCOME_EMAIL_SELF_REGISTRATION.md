# Email di Benvenuto per Registrazione Autonoma

## Panoramica

Questa funzionalità invia automaticamente un'email di benvenuto agli utenti che si registrano autonomamente sulla piattaforma Nollix.

## Come Funziona

### 1. Sistema Semplificato
Quando un utente completa la registrazione autonomamente:
- Il trigger `on_auth_user_created` si attiva automaticamente
- Viene creato il profilo utente nella tabella `profiles`
- L'email di benvenuto viene inviata **direttamente** tramite `send-email`

### 2. Invio Diretto
- L'email viene inviata immediatamente durante la registrazione
- Non è necessaria una coda email separata
- Il sistema è più semplice e affidabile

### 3. Distinzione tra Tipi di Registrazione
Il sistema distingue tra:
- **Registrazione autonoma**: L'utente si registra da solo → Email di benvenuto inviata tramite `send-email` con HTML personalizzato
- **Creazione da amministratore**: L'admin crea l'account → Email con credenziali temporanee inviata tramite `send-email`

### 4. Edge Functions
- **`send-email`**: Funzione generica per invio email con HTML personalizzato (usata per tutti i tipi di email)

## File Modificati/Creati

### Migrazioni Database
- `supabase/migrations/20250115000000-remove-email-queue-system.sql`
  - Rimuove il sistema di coda email obsoleto
  - Semplifica il trigger `on_auth_user_created` per creare solo il profilo utente
  - Mantiene solo la creazione del profilo, l'email viene inviata direttamente dal frontend

### Edge Functions
- `supabase/functions/send-email/index.ts`
  - Funzione generica per invio email con HTML personalizzato
  - Invocata direttamente dal frontend durante la registrazione
  - Accetta parametri: `to`, `from`, `subject`, `html`

## Contenuto dell'Email

L'email di benvenuto include:
- Saluto personalizzato con nome dell'utente
- Conferma della registrazione completata
- Lista delle funzionalità disponibili:
  1. Esplorare il catalogo di attrezzature
  2. Prenotare attrezzature
  3. Pubblicare attrezzature proprie
  4. Gestire prenotazioni e profilo
- Link diretto per accedere alla piattaforma
- Messaggio di supporto

## Configurazione Richiesta

### Variabili d'Ambiente
- `RESEND_API_KEY`: Chiave API per l'invio email tramite Resend
- `SUPABASE_URL`: URL del progetto Supabase

### Tabelle Database
- `profiles`: Tabella per i profili utente (creata automaticamente dal trigger)

## Gestione Errori

- Se l'invio dell'email fallisce, la registrazione dell'utente non viene bloccata
- Gli errori vengono loggati ma non impediscono la creazione del profilo
- L'utente riceve comunque conferma della registrazione completata

## Test

Per testare la funzionalità:
1. Registra un nuovo utente dalla pagina di registrazione
2. Verifica che l'email di benvenuto venga inviata immediatamente
3. Controlla i log di Supabase per eventuali errori
4. Verifica che il profilo utente sia stato creato correttamente

## Note Tecniche

- Il sistema utilizza l'invio diretto delle email senza coda
- Le email vengono inviate immediatamente durante la registrazione
- Il sistema è più semplice e affidabile rispetto al sistema di coda
- Se l'invio email fallisce, la registrazione non viene bloccata
