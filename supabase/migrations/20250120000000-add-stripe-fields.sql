-- Aggiungi campo per tracciare la Stripe Checkout Session
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Aggiungi indice per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_checkout_session_id 
ON public.bookings(stripe_checkout_session_id);

