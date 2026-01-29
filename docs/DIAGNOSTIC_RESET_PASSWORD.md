# Guida Diagnostica - Problema Reset Password

## Problema
La funzione `check_email_exists_in_profiles` ritorna `false` anche se l'email esiste sia in `auth.users` che in `profiles`.

## Query di Diagnostica da Eseguire

### 1. Verifica Email in auth.users
```sql
-- Controlla se l'email esiste in auth.users
SELECT 
  id,
  email,
  LOWER(TRIM(email)) as email_normalized,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE LOWER(TRIM(email)) = LOWER(TRIM('sansone.lore@gmail.com'));  -- Sostituisci con l'email problematica
```

### 2. Verifica Email in profiles
```sql
-- Controlla se l'email esiste in profiles
SELECT 
  id,
  email,
  LOWER(TRIM(email)) as email_normalized,
  first_name,
  last_name,
  created_at
FROM public.profiles
WHERE LOWER(TRIM(email)) = LOWER(TRIM('sansone.lore@gmail.com'));  -- Sostituisci con l'email problematica
```

### 3. Verifica Email NULL in profiles
```sql
-- Controlla se ci sono profili con email NULL o vuota
SELECT 
  id,
  email,
  CASE 
    WHEN email IS NULL THEN 'NULL'
    WHEN TRIM(email) = '' THEN 'VUOTA'
    ELSE 'OK'
  END as email_status,
  first_name,
  last_name
FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE LOWER(TRIM(email)) = LOWER(TRIM('sansone.lore@gmail.com'))
);
```

### 4. Test della Funzione RPC Direttamente
```sql
-- Testa la funzione RPC direttamente
SELECT public.check_email_exists_in_profiles('sansone.lore@gmail.com');  -- Sostituisci con l'email problematica
```

### 5. Verifica Matching Esatto
```sql
-- Confronta i valori normalizzati per vedere se c'è un problema di matching
SELECT 
  au.id as auth_id,
  au.email as auth_email,
  LOWER(TRIM(au.email)) as auth_email_normalized,
  p.id as profile_id,
  p.email as profile_email,
  LOWER(TRIM(p.email)) as profile_email_normalized,
  CASE 
    WHEN LOWER(TRIM(au.email)) = LOWER(TRIM(p.email)) THEN 'MATCH'
    ELSE 'NO MATCH'
  END as match_status
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE LOWER(TRIM(au.email)) = LOWER(TRIM('sansone.lore@gmail.com'));  -- Sostituisci con l'email problematica
```

### 6. Verifica Utenti senza Profilo
```sql
-- Trova utenti in auth.users che non hanno un profilo corrispondente
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
  AND LOWER(TRIM(au.email)) = LOWER(TRIM('sansone.lore@gmail.com'));  -- Sostituisci con l'email problematica
```

### 7. Verifica Profili senza Email
```sql
-- Trova profili che hanno id corrispondente a auth.users ma email NULL o vuota
SELECT 
  p.id,
  p.email,
  au.email as auth_email,
  CASE 
    WHEN p.email IS NULL THEN 'NULL in profiles'
    WHEN TRIM(p.email) = '' THEN 'VUOTA in profiles'
    WHEN LOWER(TRIM(p.email)) != LOWER(TRIM(au.email)) THEN 'DIVERSA da auth.users'
    ELSE 'OK'
  END as email_status
FROM public.profiles p
INNER JOIN auth.users au ON p.id = au.id
WHERE au.email = 'sansone.lore@gmail.com'  -- Sostituisci con l'email problematica
  AND (p.email IS NULL OR TRIM(p.email) = '' OR LOWER(TRIM(p.email)) != LOWER(TRIM(au.email)));
```

### 8. Verifica Permessi della Funzione
```sql
-- Controlla i permessi della funzione
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'check_email_exists_in_profiles';
```

### 9. Test con Email Esatta dalla Tabella
```sql
-- Prendi l'email esatta come salvata in profiles e testala
SELECT 
  email as original_email,
  LOWER(TRIM(email)) as normalized_email,
  public.check_email_exists_in_profiles(email) as function_result,
  public.check_email_exists_in_profiles(LOWER(TRIM(email))) as function_result_normalized
FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'sansone.lore@gmail.com'
)
LIMIT 1;
```

### 10. Verifica Caratteri Speciali o Encoding
```sql
-- Controlla se ci sono caratteri invisibili o problemi di encoding
SELECT 
  id,
  email,
  LENGTH(email) as email_length,
  LENGTH(TRIM(email)) as trimmed_length,
  encode(email::bytea, 'hex') as email_hex,
  ascii(email) as first_char_ascii
FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE email LIKE '%sansone.lore%'
);
```

## Possibili Cause del Problema

### 1. Email NULL in profiles
**Causa**: Il trigger `on_auth_user_created` potrebbe essere fallito silenziosamente durante la creazione del profilo, lasciando `email = NULL` in `profiles`.

**Verifica**: Esegui la query #3 e #7

**Soluzione**: Aggiornare manualmente i profili con email NULL:
```sql
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
  AND (p.email IS NULL OR TRIM(p.email) = '');
```

### 2. Problema di Matching (Spazi/Caratteri)
**Causa**: Differenze sottili tra l'email in `auth.users` e `profiles` (spazi, caratteri invisibili, encoding).

**Verifica**: Esegui la query #5 e #10

**Soluzione**: Normalizzare tutte le email:
```sql
UPDATE public.profiles
SET email = TRIM(LOWER(email))
WHERE email IS NOT NULL;
```

### 3. Problema RLS (Row Level Security)
**Causa**: Anche se la funzione usa `SECURITY DEFINER`, potrebbe esserci un problema con le policy RLS sulla tabella `profiles`.

**Verifica**: Esegui la query #8 e controlla le policy RLS:
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

**Soluzione**: Verificare che la funzione abbia i permessi corretti o disabilitare temporaneamente RLS per test:
```sql
-- SOLO PER TEST - NON IN PRODUZIONE
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- Testa la funzione
-- Poi riabilita
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

### 4. Utente Creato Prima dell'Email Column
**Causa**: Utenti creati prima che la colonna `email` fosse aggiunta a `profiles` (migration `20250701154944`).

**Verifica**: Esegui la query #6

**Soluzione**: Sincronizzare email da `auth.users`:
```sql
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
  AND (p.email IS NULL OR p.email != au.email);
```

### 5. Trigger Fallito Silenziosamente
**Causa**: Il trigger `on_auth_user_created` ha un blocco `EXCEPTION WHEN others` che cattura errori silenziosamente (vedi migration `20250115000000` linea 61-63).

**Verifica**: Controlla i log di Supabase per messaggi `RAISE NOTICE` o errori del trigger.

**Soluzione**: Verificare che il trigger sia attivo:
```sql
SELECT 
  tgname as trigger_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

## Procedura di Diagnostica Consigliata

1. **Esegui le query #1 e #2** per verificare che l'email esista in entrambe le tabelle
2. **Esegui la query #3** per verificare se l'email è NULL in profiles
3. **Esegui la query #4** per testare direttamente la funzione RPC
4. **Esegui la query #5** per confrontare i valori normalizzati
5. **Se l'email è NULL in profiles**, esegui la query di aggiornamento dalla sezione "Email NULL in profiles"
6. **Se c'è un problema di matching**, esegui la query di normalizzazione dalla sezione "Problema di Matching"

## Query di Fix Rapido (da usare con cautela)

### Fix Completo: Sincronizza tutte le email da auth.users a profiles
```sql
-- Aggiorna tutti i profili con email da auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
  AND (p.email IS NULL 
       OR TRIM(p.email) = '' 
       OR LOWER(TRIM(p.email)) != LOWER(TRIM(au.email)));
```

### Verifica dopo il fix
```sql
-- Conta quanti profili hanno ancora problemi
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN email IS NULL THEN 1 END) as null_emails,
  COUNT(CASE WHEN TRIM(email) = '' THEN 1 END) as empty_emails,
  COUNT(CASE WHEN email IS NOT NULL AND TRIM(email) != '' THEN 1 END) as valid_emails
FROM public.profiles;
```

## Note Importanti

- **Backup**: Fai sempre un backup prima di eseguire UPDATE
- **Test**: Testa le query su un ambiente di sviluppo prima
- **Log**: Controlla i log di Supabase per errori del trigger
- **RLS**: Verifica che le policy RLS non blocchino la funzione


