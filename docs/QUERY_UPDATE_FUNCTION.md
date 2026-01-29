# Query per Aggiornare la Funzione check_email_exists_in_profiles

## Query da Eseguire

Esegui questa query nel **Supabase Dashboard → SQL Editor**:

```sql
-- Aggiorna la funzione per controllare auth.users invece di profiles
-- (Anche se non è più usata dal frontend, può essere utile per altre funzionalità)
CREATE OR REPLACE FUNCTION public.check_email_exists_in_profiles(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  -- Controlla direttamente in auth.users (fonte di verità per l'autenticazione)
  -- auth.users non ha RLS, quindi non ci sono problemi di permessi
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(email_to_check))
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Assicurati che tutti possano eseguire la funzione
GRANT EXECUTE ON FUNCTION public.check_email_exists_in_profiles(text) TO anon, authenticated, service_role;
```

## Nota

Questa funzione **non è più usata** dal frontend (`ForgotPasswordForm.tsx`), ma può essere utile per altre parti del codice che potrebbero ancora chiamarla.

Se vuoi, puoi anche lasciarla così com'è (controlla `profiles`) dato che non viene più usata.


