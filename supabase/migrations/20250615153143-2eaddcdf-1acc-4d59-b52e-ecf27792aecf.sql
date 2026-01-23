
-- Permetti al proprietario dell'annuncio di vedere le prenotazioni dei suoi prodotti
CREATE POLICY "Owner can view bookings for own products"
  ON public.bookings
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR 
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = bookings.product_id AND products.user_id = auth.uid()
    )
  );
