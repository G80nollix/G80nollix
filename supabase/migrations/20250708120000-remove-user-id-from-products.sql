-- Rimuovi la colonna user_id dalla tabella products
ALTER TABLE public.products DROP COLUMN IF EXISTS user_id;

-- Aggiorna la policy sulle bookings: rimuovi il controllo su products.user_id
DROP POLICY IF EXISTS "Owner can view bookings for own products" ON public.bookings;

CREATE POLICY "Owner can view bookings for own products"
  ON public.bookings
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Aggiorna eventuali insert di esempio (da fare a mano nei file di seed se necessario) 