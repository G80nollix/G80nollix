-- ============================================
-- Ripristina il trigger on_auth_user_created su auth.users dopo dump/upload
-- ============================================
-- IMPORTANTE: I trigger su auth.users NON vengono trasferiti durante dump/upload
-- perché lo schema 'auth' è gestito da Supabase Auth.
-- 
-- Questa migration:
-- - Crea solo il trigger on_auth_user_created (per INSERT)
-- - Rimuove on_auth_user_updated se esiste (non usato nel dev)
-- 
-- Esegui questa migration dopo ogni dump/upload per ripristinare il trigger.
-- Questa migration è idempotente: può essere eseguita più volte senza problemi.
-- ============================================

-- 1. Funzione handle_new_user() per INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Inserisci il profilo nella tabella profiles
  -- IMPORTANTE: Questo trigger NON deve bloccare la registrazione anche se fallisce
  BEGIN
    INSERT INTO public.profiles (
      id, 
      email,
      first_name, 
      last_name, 
      phone,
      birth_date,
      user_type,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'given_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name', ''),
      NEW.raw_user_meta_data->>'phone',
      CASE 
        WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL 
        AND NEW.raw_user_meta_data->>'birth_date' != '' 
        THEN (NEW.raw_user_meta_data->>'birth_date')::date
        ELSE NULL
      END,
      COALESCE(NEW.raw_user_meta_data->>'user_type', 'individual'),
      NOW(),
      NOW()
    );
    
  EXCEPTION WHEN others THEN
    -- NON bloccare la registrazione se c'è un errore
    -- Log dell'errore ma continua
    RAISE WARNING 'Error inserting profile for user %: %', NEW.id, SQLERRM;
    -- IMPORTANTE: Return NEW per non bloccare la registrazione
  END;
  
  RETURN NEW;
END;
$function$;

-- 2. Rimuovi il trigger on_auth_user_updated se esiste (non lo usiamo nel dev)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 3. Rimuovi la funzione handle_user_profile_update se esiste (non la usiamo nel dev)
DROP FUNCTION IF EXISTS public.handle_user_profile_update();

-- 4. Trigger on_auth_user_created (AFTER INSERT)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

