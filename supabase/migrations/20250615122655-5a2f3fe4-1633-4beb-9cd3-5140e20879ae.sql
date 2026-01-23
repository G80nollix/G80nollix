
-- Aggiungi la colonna 'address' alla tabella products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS address TEXT;
