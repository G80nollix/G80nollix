-- Rimuovi colonna stripe_refund_id dalla tabella bookings
-- Ora i rimborsi sono gestiti nella tabella dedicata refunds

-- Rimuovi l'indice associato
DROP INDEX IF EXISTS public.idx_bookings_stripe_refund_id;

-- Rimuovi la colonna
ALTER TABLE public.bookings
DROP COLUMN IF EXISTS stripe_refund_id;

