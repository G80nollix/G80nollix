-- Aggiungi un trigger per aggiornare automaticamente la tabella profiles
-- quando vengono modificati i metadati dell'utente in auth.users

-- Funzione per gestire l'aggiornamento del profilo
CREATE OR REPLACE FUNCTION public.handle_user_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Aggiorna la tabella profiles quando vengono modificati i metadati dell'utente
  UPDATE public.profiles
  SET
    first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', OLD.raw_user_meta_data->>'first_name'),
    last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', OLD.raw_user_meta_data->>'last_name'),
    phone = COALESCE(NEW.raw_user_meta_data->>'phone', OLD.raw_user_meta_data->>'phone'),
    birth_date = COALESCE(NEW.raw_user_meta_data->>'birth_date', OLD.raw_user_meta_data->>'birth_date'),
    user_type = COALESCE(NEW.raw_user_meta_data->>'user_type', OLD.raw_user_meta_data->>'user_type'),
    updated_at = NOW()
  WHERE id = NEW.id;
  
  -- Se il profilo non esiste ancora, crealo
  IF NOT FOUND THEN
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
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'birth_date',
      NEW.raw_user_meta_data->>'user_type',
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crea il trigger per l'aggiornamento
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_profile_update();
