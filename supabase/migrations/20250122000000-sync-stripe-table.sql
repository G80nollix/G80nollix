-- Crea tabella stripe per sincronizzazione in tempo reale
-- Questa tabella viene aggiornata automaticamente dai webhook Stripe

CREATE TABLE IF NOT EXISTS public.stripe (
  id TEXT PRIMARY KEY, -- Stripe object ID (checkout session, payment intent, etc.)
  subscription TEXT,
  payment_intent TEXT,
  customer TEXT,
  object_type TEXT, -- Tipo di oggetto Stripe (checkout.session, payment_intent, etc.)
  event_type TEXT, -- Tipo di evento (checkout.session.completed, payment_intent.succeeded, etc.)
  status TEXT, -- Stato del pagamento/oggetto
  amount NUMERIC, -- Importo in centesimi
  currency TEXT DEFAULT 'eur',
  metadata JSONB, -- Metadati aggiuntivi
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indici per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intent ON public.stripe(payment_intent);
CREATE INDEX IF NOT EXISTS idx_stripe_customer ON public.stripe(customer);
CREATE INDEX IF NOT EXISTS idx_stripe_subscription ON public.stripe(subscription);
CREATE INDEX IF NOT EXISTS idx_stripe_object_type ON public.stripe(object_type);
CREATE INDEX IF NOT EXISTS idx_stripe_created_at ON public.stripe(created_at);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_stripe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stripe_updated_at
  BEFORE UPDATE ON public.stripe
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_updated_at();

-- Abilita RLS (Row Level Security)
ALTER TABLE public.stripe ENABLE ROW LEVEL SECURITY;

-- Policy: solo gli admin possono vedere tutti i dati Stripe
-- Gli utenti possono vedere solo i propri dati (se necessario)
CREATE POLICY "Admin can view all stripe data"
  ON public.stripe
  FOR SELECT
  USING (true); -- Per ora tutti possono vedere, modifica secondo le tue esigenze


