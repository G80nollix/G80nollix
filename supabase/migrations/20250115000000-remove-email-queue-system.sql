-- Rimuove il sistema di coda email che non è più necessario
-- L'invio diretto tramite send-email è sufficiente

-- Rimuovi il trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Rimuovi la funzione
DROP FUNCTION IF EXISTS public.add_welcome_email_to_queue();

-- Rimuovi la tabella email_queue
DROP TABLE IF EXISTS public.email_queue;

-- Crea un trigger semplificato che crea solo il profilo utente
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  firstName TEXT;
  lastName TEXT;
BEGIN
  -- Estrai i dati dell'utente
  firstName := COALESCE(
    NEW.raw_user_meta_data->>'first_name', 
    NEW.raw_user_meta_data->>'given_name',
    split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1)
  );
  
  lastName := COALESCE(
    NEW.raw_user_meta_data->>'last_name', 
    NEW.raw_user_meta_data->>'family_name',
    split_part(NEW.raw_user_meta_data->>'full_name', ' ', 2)
  );
  
  -- Inserisci il profilo nella tabella profiles
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
      NEW.email,
      firstName,
      lastName,
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'birth_date',
      COALESCE(NEW.raw_user_meta_data->>'user_type', 'individual'),
      NOW(),
      NOW()
    );
    
  EXCEPTION WHEN others THEN
    -- Non bloccare la registrazione se c'è un errore
    RAISE NOTICE 'Error inserting profile: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;

-- Crea il nuovo trigger semplificato
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();
