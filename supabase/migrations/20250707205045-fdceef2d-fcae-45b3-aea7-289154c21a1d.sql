
-- Aggiorna il ruolo dell'utente cirqlo.info@gmail.com a admin
UPDATE public.profiles 
SET user_type = 'admin' 
WHERE email = 'cirqlo.info@gmail.com';
