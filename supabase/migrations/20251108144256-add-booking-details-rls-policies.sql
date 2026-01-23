-- Applica le stesse policy RLS di bookings alla tabella booking_details

-- Abilita RLS se non già abilitato
ALTER TABLE public.booking_details ENABLE ROW LEVEL SECURITY;

-- Rimuovi eventuali policy esistenti per ricrearle
DROP POLICY IF EXISTS "Users can view own booking_details" ON public.booking_details;
DROP POLICY IF EXISTS "Users can insert their booking_details" ON public.booking_details;
DROP POLICY IF EXISTS "Users can update their booking_details" ON public.booking_details;
DROP POLICY IF EXISTS "Users can delete their booking_details" ON public.booking_details;
DROP POLICY IF EXISTS "Anyone can view product booking_details for availability check" ON public.booking_details;
DROP POLICY IF EXISTS "Owner can view booking_details for own products" ON public.booking_details;

-- Policy: ogni utente vede solo i propri booking_details
CREATE POLICY "Users can view own booking_details"
  ON public.booking_details
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: ogni utente può inserire i propri booking_details
CREATE POLICY "Users can insert their booking_details"
  ON public.booking_details
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: ogni utente può aggiornare solo i propri booking_details
CREATE POLICY "Users can update their booking_details"
  ON public.booking_details
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: ogni utente può cancellare solo i propri booking_details
CREATE POLICY "Users can delete their booking_details"
  ON public.booking_details
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: chiunque può vedere tutti i booking_details per il controllo della disponibilità
CREATE POLICY "Anyone can view product booking_details for availability check"
  ON public.booking_details
  FOR SELECT
  USING (true);

-- Policy: il proprietario del prodotto può vedere i booking_details dei suoi prodotti
-- Nota: user_id è stato rimosso da products, quindi questa policy è semplificata
CREATE POLICY "Owner can view booking_details for own products"
  ON public.booking_details
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

