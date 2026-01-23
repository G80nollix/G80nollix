
-- Aggiorna la funzione handle_new_user per includere anche l'email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
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
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'user_type',
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

-- Aggiungi la colonna email alla tabella profiles se non esiste già
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Aggiorna nuovamente la funzione per includere l'email
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
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'user_type',
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
