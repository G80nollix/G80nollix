# Processo di Reset Password - Analisi Completa

## Panoramica

Questo documento descrive in dettaglio come funziona il processo di reset password, con particolare attenzione all'uso delle tabelle `auth.users` e `profiles`.

## Uso delle Tabelle

### Tabella `auth.users`
- **Scopo**: Tabella gestita da Supabase Auth, contiene le credenziali di autenticazione
- **Contenuto**: 
  - `id` (UUID)
  - `email` (string)
  - `encrypted_password` (hash della password)
  - `email_confirmed_at` (timestamp)
  - `raw_user_meta_data` (JSON con metadati)
- **Accesso**: Solo tramite API Supabase Auth o funzioni SECURITY DEFINER
- **Ruolo nel reset**: **Fonte di verità** per l'autenticazione. `resetPasswordForEmail()` controlla solo questa tabella.

### Tabella `profiles`
- **Scopo**: Tabella pubblica con dati estesi del profilo utente
- **Contenuto**:
  - `id` (UUID, FK a `auth.users.id`)
  - `email` (string, duplicato per facilità di query)
  - `first_name`, `last_name`, `phone`, ecc.
- **Accesso**: Tramite query SQL standard (con RLS)
- **Ruolo nel reset**: Usata solo per il **controllo preliminare** tramite RPC `check_email_exists_in_profiles`

## Problema Identificato

**Disallineamento tra controllo e azione:**
- Il controllo preliminare usa `profiles` (funzione RPC `check_email_exists_in_profiles`)
- L'azione di reset usa `auth.users` (funzione Supabase `resetPasswordForEmail`)
- Se l'email esiste in `auth.users` ma non in `profiles`, il reset viene bloccato prima ancora di chiamare Supabase

## Flusso Dettagliato

### Fase 1: Richiesta Reset Password (`ForgotPasswordForm.tsx`)

```
1. Utente inserisce email nel form
   ↓
2. Validazione lato client (validateEmail)
   ↓
3. Chiamata RPC: check_email_exists_in_profiles(email)
   ├─ Query: SELECT 1 FROM profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM(email_to_check))
   ├─ Tabella usata: profiles
   └─ Risultato: boolean (true/false)
   ↓
4. Se email NON trovata in profiles:
   ├─ Mostra errore: "Email non trovata"
   └─ STOP (non procede)
   ↓
5. Se email trovata in profiles:
   ├─ Prepara redirectUrl
   └─ Chiama: supabase.auth.resetPasswordForEmail(email, { redirectTo })
      ├─ Supabase controlla internamente in auth.users
      ├─ Se email NON esiste in auth.users → errore silenzioso
      ├─ Se email esiste in auth.users:
      │  ├─ Genera token di reset (scade in 1 ora)
      │  ├─ Crea link: {redirectUrl}?access_token=...&refresh_token=...&type=recovery
      │  └─ Invia email all'utente
      └─ Risultato: email inviata (o errore)
```

### Fase 2: Click sul Link Email

```
1. Utente clicca link nell'email
   ↓
2. Browser naviga a: /reset-password?access_token=...&refresh_token=...&type=recovery
   ↓
3. ResetPasswordPage.tsx si monta
   ↓
4. useEffect estrae token dalla URL (hash o query params)
   ↓
5. Verifica tipo: type === 'recovery'
   ↓
6. Chiama: supabase.auth.setSession({ access_token, refresh_token })
   ├─ Supabase verifica token
   ├─ Se token valido → crea sessione autenticata
   └─ Se token scaduto/invalido → errore
   ↓
7. Se sessione valida:
   ├─ Mostra form per nuova password
   └─ isValidSession = true
```

### Fase 3: Aggiornamento Password

```
1. Utente inserisce nuova password (2 volte per conferma)
   ↓
2. Validazione:
   ├─ Password devono coincidere
   └─ Password minimo 6 caratteri
   ↓
3. Chiama: supabase.auth.updateUser({ password: newPassword })
   ├─ Supabase aggiorna encrypted_password in auth.users
   ├─ Tabella usata: auth.users
   └─ profiles NON viene toccata
   ↓
4. Se successo:
   ├─ Mostra messaggio: "Password aggiornata"
   └─ Redirect a /auth?mode=login dopo 3 secondi
```

## Diagramma di Flusso Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    RICHIESTA RESET PASSWORD                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Utente inserisce    │
                    │ email nel form      │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Validazione email   │
                    │ (lato client)       │
                    └─────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │ RPC: check_email_exists_in_profiles()    │
        │ Query: SELECT FROM profiles              │
        │ WHERE email = input_email                │
        └─────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
         Email NON trovata          Email trovata
         in profiles                in profiles
                │                           │
                ▼                           ▼
    ┌───────────────────┐      ┌──────────────────────────┐
    │ Errore: "Email    │      │ supabase.auth.            │
    │ non trovata"      │      │ resetPasswordForEmail()    │
    │                   │      │                           │
    │ STOP              │      │ Supabase controlla       │
    └───────────────────┘      │ internamente in auth.users │
                               └──────────────────────────┘
                                         │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                Email NON trovata                  Email trovata
                in auth.users                      in auth.users
                        │                                   │
                        ▼                                   ▼
            ┌──────────────────────┐      ┌──────────────────────────┐
            │ Errore silenzioso    │      │ Genera token di reset    │
            │ (non mostrato)       │      │ (scade in 1 ora)         │
            │                      │      │                          │
            │ STOP                 │      │ Crea link con token      │
            └──────────────────────┘      │                          │
                                          │ Invia email all'utente   │
                                          └──────────────────────────┘
                                                     │
                                                     ▼
                                    ┌──────────────────────────┐
                                    │ Email inviata con         │
                                    │ successo                 │
                                    │                          │
                                    │ Mostra: "Email inviata!" │
                                    └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    CLICK SUL LINK EMAIL                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Browser naviga a:   │
                    │ /reset-password?    │
                    │ access_token=...    │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ ResetPasswordPage   │
                    │ estrae token        │
                    └─────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │ supabase.auth.setSession({              │
        │   access_token,                         │
        │   refresh_token                         │
        │ })                                      │
        │                                         │
        │ Supabase verifica token                 │
        └─────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
         Token valido              Token scaduto/
         (non scaduto)             invalido
                │                           │
                ▼                           ▼
    ┌───────────────────┐      ┌──────────────────────────┐
    │ Sessione creata   │      │ Errore: "Link non valido │
    │                    │      │ o scaduto"                │
    │ isValidSession     │      │                          │
    │ = true             │      │ Redirect a /auth?mode=   │
    │                    │      │ login                    │
    │ Mostra form        │      │                          │
    │ password           │      │ STOP                     │
    └───────────────────┘      └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    AGGIORNAMENTO PASSWORD                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Utente inserisce    │
                    │ nuova password      │
                    │ (2 volte)           │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Validazione:        │
                    │ - Password uguali   │
                    │ - Min 6 caratteri   │
                    └─────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │ supabase.auth.updateUser({              │
        │   password: newPassword                 │
        │ })                                      │
        │                                         │
        │ Supabase aggiorna:                     │
        │ - encrypted_password in auth.users       │
        │ - profiles NON viene toccata            │
        └─────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
            Successo                    Errore
                │                           │
                ▼                           ▼
    ┌───────────────────┐      ┌──────────────────────────┐
    │ Password          │      │ Mostra errore            │
    │ aggiornata        │      │                          │
    │                   │      │ STOP                     │
    │ Messaggio:        │      └──────────────────────────┘
    │ "Password         │
    │ aggiornata!"      │
    │                   │
    │ Redirect a        │
    │ /auth?mode=login  │
    │ dopo 3 secondi    │
    └───────────────────┘
```

## Punti Critici

### 1. Disallineamento tra `profiles` e `auth.users`
- **Problema**: Il controllo preliminare usa `profiles`, ma `resetPasswordForEmail` usa `auth.users`
- **Conseguenza**: Se l'email esiste solo in `auth.users`, il reset viene bloccato erroneamente
- **Soluzione suggerita**: Controllare direttamente in `auth.users` o in entrambe le tabelle

### 2. Gestione errori silenziosi
- **Problema**: Se `resetPasswordForEmail` fallisce perché l'email non esiste in `auth.users`, l'errore potrebbe non essere mostrato chiaramente
- **Conseguenza**: L'utente vede "Email inviata" anche se in realtà non è stata inviata

### 3. Sincronizzazione tra tabelle
- **Problema**: Se un utente esiste in `auth.users` ma non in `profiles`, c'è un'inconsistenza
- **Causa possibile**: Trigger `on_auth_user_created` fallito silenziosamente durante la registrazione

## Funzioni Database Coinvolte

### `check_email_exists_in_profiles(email_to_check text)`
- **Tipo**: RPC Function (SECURITY DEFINER)
- **Tabella**: `profiles`
- **Query**: `SELECT 1 FROM profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM(email_to_check))`
- **Uso**: Controllo preliminare prima di chiamare `resetPasswordForEmail`

## API Supabase Coinvolte

### `supabase.auth.resetPasswordForEmail(email, options)`
- **Tabella usata internamente**: `auth.users`
- **Azione**: 
  1. Verifica email in `auth.users`
  2. Genera token di reset
  3. Invia email con link
- **Scadenza token**: 1 ora (default)

### `supabase.auth.setSession({ access_token, refresh_token })`
- **Azione**: Crea sessione autenticata dal token di reset
- **Verifica**: Token deve essere valido e non scaduto

### `supabase.auth.updateUser({ password })`
- **Tabella usata**: `auth.users`
- **Azione**: Aggiorna `encrypted_password` per l'utente autenticato
- **Nota**: Non tocca la tabella `profiles`


