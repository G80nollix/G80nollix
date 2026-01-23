
-- Aggiorna la funzione handle_new_user per gestire anche Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email,
    first_name, 
    last_name, 
    phone, 
    user_type,
    birth_date,
    address,
    city,
    postal_code,
    province,
    tax_code
  )
  VALUES (
    NEW.id,
    NEW.email,
    -- Per Google OAuth, usa 'given_name' e 'family_name', altrimenti usa i campi del form
    COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'given_name'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'individual'),
    (NEW.raw_user_meta_data->>'birth_date')::date,
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'postal_code',
    NEW.raw_user_meta_data->>'province',
    NEW.raw_user_meta_data->>'tax_code'
  );
  RETURN NEW;
END;
$function$
