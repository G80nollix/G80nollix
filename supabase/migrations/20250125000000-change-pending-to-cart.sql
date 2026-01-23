-- Migrazione: Cambiare status 'pending' in 'cart' per la tabella bookings
-- Data: 2025-01-25

-- 1. Aggiorna tutti i record esistenti con status 'pending' a 'cart'
UPDATE public.bookings 
SET status = 'cart' 
WHERE status = 'pending';

-- 2. Aggiorna il DEFAULT del campo status da 'pending' a 'cart'
ALTER TABLE public.bookings 
ALTER COLUMN status SET DEFAULT 'cart';

-- Nota: Se ci sono CHECK constraints o enum che includono 'pending', 
-- potrebbero essere necessarie modifiche aggiuntive. 
-- Verificare eventuali vincoli esistenti prima di applicare questa migrazione.
