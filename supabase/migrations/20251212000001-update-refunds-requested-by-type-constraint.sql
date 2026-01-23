-- Aggiorna il constraint CHECK per requested_by_type per accettare 'individual' invece di 'user'
-- Questo allinea il database con il codice che usa 'individual' per gli utenti normali

-- Rimuovi il constraint esistente
ALTER TABLE public.refunds 
DROP CONSTRAINT IF EXISTS refunds_requested_by_type_check;

-- Aggiungi il nuovo constraint con 'individual' invece di 'user'
ALTER TABLE public.refunds
ADD CONSTRAINT refunds_requested_by_type_check 
CHECK (requested_by_type IN ('admin', 'individual'));

-- Aggiorna eventuali record esistenti con 'user' a 'individual'
UPDATE public.refunds
SET requested_by_type = 'individual'
WHERE requested_by_type = 'user';









