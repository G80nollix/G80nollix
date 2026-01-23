
-- Aggiorniamo la funzione per gestire il formato dati di Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Log per debug
  RAISE NOTICE 'Trigger fired for user ID: %', NEW.id;
  RAISE NOTICE 'User email: %', NEW.email;
  RAISE NOTICE 'Raw user meta data: %', NEW.raw_user_meta_data;
  
  -- Proviamo a fare l'insert con gestione corretta dei dati Google
  BEGIN
    INSERT INTO public.profiles (
      id, 
      email,
      first_name, 
      last_name, 
      user_type
    )
    VALUES (
      NEW.id,
      NEW.email,
      -- Google OAuth può fornire full_name, given_name, o first_name
      COALESCE(
        NEW.raw_user_meta_data->>'first_name', 
        NEW.raw_user_meta_data->>'given_name',
        split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1)
      ),
      COALESCE(
        NEW.raw_user_meta_data->>'last_name', 
        NEW.raw_user_meta_data->>'family_name',
        split_part(NEW.raw_user_meta_data->>'full_name', ' ', 2)
      ),
      COALESCE(NEW.raw_user_meta_data->>'user_type', 'individual')
    );
    
    RAISE NOTICE 'Profile inserted successfully for user: %', NEW.id;
    
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error inserting profile: %', SQLERRM;
    -- Non bloccare la registrazione se c'è un errore
  END;
  
  RETURN NEW;
END;
$function$;
