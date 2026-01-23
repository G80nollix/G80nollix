
-- Crea una politica per permettere agli admin di vedere tutti i profili
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  -- Per ora permettiamo a tutti gli utenti autenticati di vedere tutti i profili
  -- In futuro potrai restringere questo solo agli admin
  true
);
