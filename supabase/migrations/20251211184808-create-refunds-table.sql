-- Crea tabella refunds per gestire i rimborsi Stripe
-- Un PaymentIntent può avere più refunds, ogni refund ha un ID univoco

-- Crea funzione is_admin_user() se non esiste già
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.id = auth.uid() 
      AND p.user_type = 'admin'
  )
$$;

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_refund_id TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indici per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_refunds_booking_id 
  ON public.refunds(booking_id);

CREATE INDEX IF NOT EXISTS idx_refunds_stripe_payment_intent_id 
  ON public.refunds(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_refunds_stripe_refund_id 
  ON public.refunds(stripe_refund_id);

CREATE INDEX IF NOT EXISTS idx_refunds_status 
  ON public.refunds(status);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_refunds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_refunds_updated_at();

-- Abilita RLS (Row Level Security)
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Policy: utenti autenticati possono vedere i refunds dei propri bookings
CREATE POLICY "Users can view refunds for their bookings"
  ON public.refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.bookings b 
      WHERE b.id = refunds.booking_id 
        AND b.user_id = auth.uid()
    )
  );

-- Policy: admin possono vedere tutti i refunds
CREATE POLICY "Admins can view all refunds"
  ON public.refunds
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

-- Policy: admin possono inserire refunds (tramite webhook Stripe o manualmente)
CREATE POLICY "Admins can insert refunds"
  ON public.refunds
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user());

-- Policy: utenti possono inserire refunds per i propri bookings
CREATE POLICY "Users can insert refunds for their bookings"
  ON public.refunds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.bookings b 
      WHERE b.id = refunds.booking_id 
        AND b.user_id = auth.uid()
    )
  );

-- Policy: admin possono aggiornare refunds
CREATE POLICY "Admins can update refunds"
  ON public.refunds
  FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Policy: utenti possono aggiornare refunds per i propri bookings
CREATE POLICY "Users can update refunds for their bookings"
  ON public.refunds
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.bookings b 
      WHERE b.id = refunds.booking_id 
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.bookings b 
      WHERE b.id = refunds.booking_id 
        AND b.user_id = auth.uid()
    )
  );

-- Policy: solo admin possono cancellare refunds
CREATE POLICY "Admins can delete refunds"
  ON public.refunds
  FOR DELETE
  TO authenticated
  USING (is_admin_user());

