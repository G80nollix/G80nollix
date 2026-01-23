
-- Creiamo una funzione che controlla se un'email esiste nella tabella profiles
-- Questa funzione usa SECURITY DEFINER per bypassare le politiche RLS
CREATE OR REPLACE FUNCTION public.check_email_exists_in_profiles(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(email_to_check))
  );
END;
$$;
