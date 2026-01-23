-- Aggiungi la colonna 'images' alla tabella products per salvare le immagini
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'::text[];

-- Aggiungi un commento alla colonna
COMMENT ON COLUMN public.products.images IS 'Array di URL delle immagini del prodotto';

