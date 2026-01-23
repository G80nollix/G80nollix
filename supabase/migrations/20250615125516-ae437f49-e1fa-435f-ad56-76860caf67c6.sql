
-- Tabella bookings per gestire le prenotazioni di prodotti
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_value INTEGER NOT NULL,
  duration_unit TEXT NOT NULL CHECK (duration_unit IN ('hour', 'day', 'week', 'month')),
  price_total NUMERIC NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('pickup', 'delivery')),
  delivery_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, cancelled, completed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Abilita RLS (lato utente)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Policy: ogni utente vede solo le proprie prenotazioni
CREATE POLICY "Users can view own bookings"
  ON public.bookings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: ogni utente può inserire le proprie prenotazioni
CREATE POLICY "Users can insert their bookings"
  ON public.bookings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: ogni utente può aggiornare solo le proprie prenotazioni
CREATE POLICY "Users can update their bookings"
  ON public.bookings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: ogni utente può cancellare solo le proprie prenotazioni
CREATE POLICY "Users can delete their bookings"
  ON public.bookings
  FOR DELETE
  USING (auth.uid() = user_id);

