
-- Crea un enum per i ruoli
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Crea la tabella user_roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Abilita RLS sulla tabella user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Crea una funzione security definer per verificare i ruoli
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy per permettere agli utenti di vedere i propri ruoli
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy per permettere agli admin di vedere tutti i ruoli
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy per permettere agli admin di gestire i ruoli
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Inserisci l'utente admin (prima devi registrarlo manualmente tramite l'interfaccia)
-- Questo comando andrà eseguito dopo aver creato l'account admin@admin.it
-- INSERT INTO public.user_roles (user_id, role) 
-- SELECT id, 'admin'::app_role 
-- FROM auth.users 
-- WHERE email = 'admin@admin.it';
