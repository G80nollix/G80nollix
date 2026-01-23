
-- Elimina tutte le policy che potrebbero ancora essere collegate alla tabella user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles; 
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Elimina la funzione has_role se esiste ancora
DROP FUNCTION IF EXISTS public.has_role(_user_id uuid, _role app_role);

-- Elimina la tabella user_roles
DROP TABLE IF EXISTS public.user_roles;

-- Elimina l'enum app_role se esiste ancora
DROP TYPE IF EXISTS public.app_role;

-- Aggiorna il constraint per user_type nella tabella profiles per supportare solo 'individual' e 'admin'
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('individual', 'admin'));

-- Aggiorna la policy per permettere agli admin di vedere tutti i profili
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.user_type = 'admin'
  )
);
