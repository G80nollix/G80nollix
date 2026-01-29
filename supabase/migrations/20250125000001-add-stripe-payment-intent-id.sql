-- Aggiungi campo per tracciare il PaymentIntent ID di Stripe
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Aggiungi indice per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id 
ON public.bookings(stripe_payment_intent_id);

