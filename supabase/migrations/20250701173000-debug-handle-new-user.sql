
-- Funzione per gestire la creazione di nuovi utenti
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
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
      COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'given_name'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name'),
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

-- Assicuriamoci che il trigger esista
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
