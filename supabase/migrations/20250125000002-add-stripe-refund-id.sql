-- Aggiungi campo per tracciare il Refund ID di Stripe
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

-- Aggiungi indice per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_refund_id 
ON public.bookings(stripe_refund_id);

