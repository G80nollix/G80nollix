-- Migration: Cambio product_related da id_product_variant a id_product
-- Questo permette di associare i prodotti correlati a livello di prodotto, non di variante
-- Tutte le varianti di un prodotto saranno considerate correlate

-- Step 1: Creare una tabella temporanea per migrare i dati
CREATE TABLE IF NOT EXISTS public.product_related_temp (
    id UUID PRIMARY KEY,
    id_product UUID NOT NULL,
    id_related UUID NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- Step 2: Migrare i dati esistenti da id_product_variant a id_product
-- Per ogni entry in product_related, prendiamo l'id_product dalla variante corrispondente
INSERT INTO public.product_related_temp (id, id_product, id_related, created_at, updated_at)
SELECT 
    pr.id,
    pv.id_product,
    pr.id_related,
    pr.created_at,
    pr.updated_at
FROM public.product_related pr
INNER JOIN public.product_variants pv ON pr.id_product_variant = pv.id;

-- Step 3: Eliminare duplicati (se ci sono più varianti dello stesso prodotto con lo stesso id_related)
-- Manteniamo solo una entry per prodotto con lo stesso id_related
DELETE FROM public.product_related_temp pr1
WHERE EXISTS (
    SELECT 1 
    FROM public.product_related_temp pr2 
    WHERE pr2.id_product = pr1.id_product 
    AND pr2.id_related = pr1.id_related 
    AND pr2.id < pr1.id
);

-- Step 4: Eliminare la tabella originale
DROP TABLE IF EXISTS public.product_related CASCADE;

-- Step 5: Ricreare la tabella con la nuova struttura
CREATE TABLE public.product_related (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_product UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    id_related UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Vincolo: un prodotto può avere solo un id_related
    UNIQUE(id_product)
);

-- Step 6: Ripristinare i dati dalla tabella temporanea
INSERT INTO public.product_related (id, id_product, id_related, created_at, updated_at)
SELECT id, id_product, id_related, created_at, updated_at
FROM public.product_related_temp;

-- Step 7: Eliminare la tabella temporanea
DROP TABLE IF EXISTS public.product_related_temp;

-- Step 8: Ricreare gli indici
CREATE INDEX IF NOT EXISTS idx_product_related_product ON public.product_related(id_product);
CREATE INDEX IF NOT EXISTS idx_product_related_id_related ON public.product_related(id_related);

-- Step 9: Ricreare il trigger per updated_at
CREATE OR REPLACE FUNCTION update_product_related_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_related_updated_at
    BEFORE UPDATE ON public.product_related
    FOR EACH ROW
    EXECUTE FUNCTION update_product_related_updated_at();

-- Step 10: Ricreare le RLS policies
ALTER TABLE public.product_related ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read product_related"
    ON public.product_related
    FOR SELECT
    USING (true);

CREATE POLICY "Only admins can modify product_related"
    ON public.product_related
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.user_type = 'admin'
        )
    );

-- Step 11: Aggiornare i commenti
COMMENT ON TABLE public.product_related IS 'Tabella per gestire i prodotti correlati. Prodotti con lo stesso id_related sono correlati tra loro.';
COMMENT ON COLUMN public.product_related.id_product IS 'ID del prodotto (non della variante). Tutte le varianti di un prodotto sono considerate correlate.';
COMMENT ON COLUMN public.product_related.id_related IS 'ID che raggruppa prodotti correlati. Prodotti con lo stesso id_related sono correlati.';
