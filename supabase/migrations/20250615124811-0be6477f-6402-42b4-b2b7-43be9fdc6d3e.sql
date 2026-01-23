
-- Rimuovi la colonna delle disponibilità dai prodotti
ALTER TABLE public.products
  DROP COLUMN IF EXISTS availability_days;
