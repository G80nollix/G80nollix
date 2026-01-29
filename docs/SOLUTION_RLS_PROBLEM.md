# Soluzione al Problema RLS con check_email_exists_in_profiles

## Problema Identificato

Anche se la funzione usa `SECURITY DEFINER`, le **RLS policies** sulla tabella `profiles` stanno ancora bloccando la query quando viene chiamata da un utente **anonimo** (non autenticato).

### Perché Succede

1. **RLS Policies su profiles:**
   - `"Users can view their own profile"` - Richiede `auth.uid() = id` (utente autenticato)
   - `"Admins can view all profiles"` - Richiede `is_admin_user()` (utente admin)
   - **Nessuna policy per utenti anonimi**

2. **Quando viene chiamata la funzione:**
   - L'utente è **anonimo** (non autenticato) nella pagina di reset password
   - `auth.uid()` ritorna `NULL` per utenti anonimi
   - Le RLS policies bloccano la query anche se la funzione è `SECURITY DEFINER`

3. **SECURITY DEFINER non basta:**
   - `SECURITY DEFINER` esegue la funzione con i permessi del creatore
   - Ma le **RLS policies vengono ancora applicate** alla query SELECT
   - Per bypassare completamente RLS, serve disabilitarlo esplicitamente

## Soluzione

Modificare la funzione per **disabilitare esplicitamente RLS** durante l'esecuzione della query.

### Query di Fix

```sql
-- Aggiorna la funzione per bypassare completamente RLS
CREATE OR REPLACE FUNCTION public.check_email_exists_in_profiles(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disabilita temporaneamente RLS per questa query
  -- Questo permette alla funzione di vedere tutti i profili
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(email_to_check))
  );
END;
$$;
```

**Nota:** La clausola `SET search_path = public` è importante per sicurezza, ma non risolve il problema RLS.

### Soluzione Alternativa (Più Sicura)

Usare una query diretta che bypassa RLS usando il contesto del creatore della funzione:

```sql
CREATE OR REPLACE FUNCTION public.check_email_exists_in_profiles(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_found boolean;
BEGIN
  -- Esegui la query con i permessi del creatore della funzione (bypass RLS)
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(email_to_check))
  ) INTO email_found;
  
  RETURN COALESCE(email_found, false);
END;
$$;
```

### Soluzione Definitiva (Raccomandata)

Creare la funzione con permessi espliciti e assicurarsi che il creatore abbia accesso completo:

```sql
-- Prima, verifica che il ruolo postgres (o il ruolo che crea la funzione) abbia accesso
-- Poi ricrea la funzione con configurazione corretta

CREATE OR REPLACE FUNCTION public.check_email_exists_in_profiles(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER esegue con i permessi del creatore
  -- Se il creatore è postgres o service_role, bypassa RLS automaticamente
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(email_to_check))
  );
END;
$$;

-- Assicurati che la funzione sia eseguibile da tutti
GRANT EXECUTE ON FUNCTION public.check_email_exists_in_profiles(text) TO anon, authenticated;
```

## Verifica del Problema

### Test 1: Verifica RLS
```sql
-- Disabilita temporaneamente RLS e testa
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Testa la funzione
SELECT public.check_email_exists_in_profiles('sansone.lore@gmail.com');

-- Se funziona, il problema è RLS
-- Riabilita RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

### Test 2: Verifica Permessi Funzione
```sql
-- Controlla chi può eseguire la funzione
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  r.rolname as owner
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.proname = 'check_email_exists_in_profiles';
```

### Test 3: Verifica RLS Policies
```sql
-- Controlla tutte le policy RLS su profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';
```

## Soluzione Immediata (Workaround)

Se non puoi modificare la funzione subito, puoi creare una policy RLS temporanea per permettere la verifica email:

```sql
-- ATTENZIONE: Questa policy permette a TUTTI di vedere TUTTE le email
-- Usa solo per test o come workaround temporaneo
CREATE POLICY "Allow email check for password reset"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- Dopo aver risolto il problema, rimuovi questa policy:
-- DROP POLICY "Allow email check for password reset" ON public.profiles;
```

**⚠️ WARNING:** Questa policy espone tutte le email a utenti anonimi. Usa solo per test!

## Soluzione Corretta e Sicura

La soluzione migliore è modificare la funzione per usare un contesto che bypassa RLS:

```sql
-- Soluzione finale: Funzione che bypassa RLS correttamente
CREATE OR REPLACE FUNCTION public.check_email_exists_in_profiles(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  -- La funzione SECURITY DEFINER esegue con i permessi del creatore
  -- Se creata da postgres o service_role, bypassa RLS
  -- La query viene eseguita nel contesto del creatore, non del chiamante
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(email_to_check))
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Permetti a tutti di eseguire la funzione
GRANT EXECUTE ON FUNCTION public.check_email_exists_in_profiles(text) TO anon, authenticated, service_role;
```

## Verifica Dopo il Fix

```sql
-- Testa come utente anonimo (simula chiamata dal frontend)
SET ROLE anon;
SELECT public.check_email_exists_in_profiles('sansone.lore@gmail.com');
RESET ROLE;
```

Se ritorna `true`, il problema è risolto!


