-- Creazione tabella product_related per gestire i prodotti correlati
-- I prodotti correlati sono raggruppati tramite id_related
-- Prodotti con lo stesso id_related sono correlati tra loro

CREATE TABLE IF NOT EXISTS public.product_related (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_product_variant UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    id_related UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Vincolo: una variante può avere solo un id_related
    UNIQUE(id_product_variant)
);

-- Indice per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_product_related_variant ON public.product_related(id_product_variant);
CREATE INDEX IF NOT EXISTS idx_product_related_id_related ON public.product_related(id_related);

-- Trigger per aggiornare updated_at
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

-- Abilita RLS
ALTER TABLE public.product_related ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono leggere i prodotti correlati
CREATE POLICY "Anyone can read product_related"
    ON public.product_related
    FOR SELECT
    USING (true);

-- Policy: solo gli admin possono modificare i prodotti correlati
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

-- Commenti per documentazione
COMMENT ON TABLE public.product_related IS 'Tabella per gestire i prodotti correlati. Prodotti con lo stesso id_related sono correlati tra loro.';
COMMENT ON COLUMN public.product_related.id_product_variant IS 'ID della variante del prodotto';
COMMENT ON COLUMN public.product_related.id_related IS 'ID che raggruppa prodotti correlati. Prodotti con lo stesso id_related sono correlati.';

