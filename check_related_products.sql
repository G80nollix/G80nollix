-- Query per verificare quali prodotti hanno prodotti correlati
-- Eseguire questa query nel SQL Editor di Supabase

-- 1. Verifica se la tabella product_related esiste
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'product_related'
) AS table_exists;

-- 2. Se la tabella esiste, mostra tutti i prodotti con correlati
-- Questa query mostra:
-- - La variante del prodotto principale
-- - Il prodotto principale (nome)
-- - Gli id_related associati
-- - Quante altre varianti condividono lo stesso id_related

SELECT 
    pr.id_product_variant,
    pv.id_product,
    p.name AS product_name,
    pr.id_related,
    COUNT(*) OVER (PARTITION BY pr.id_related) AS total_related_variants
FROM product_related pr
INNER JOIN product_variants pv ON pr.id_product_variant = pv.id
INNER JOIN products p ON pv.id_product = p.id
ORDER BY pr.id_related, p.name;

-- 3. Query per vedere i gruppi di prodotti correlati
-- Mostra tutti i prodotti che condividono lo stesso id_related
SELECT 
    pr.id_related,
    COUNT(DISTINCT pr.id_product_variant) AS num_variants,
    STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name) AS related_products
FROM product_related pr
INNER JOIN product_variants pv ON pr.id_product_variant = pv.id
INNER JOIN products p ON pv.id_product = p.id
GROUP BY pr.id_related
ORDER BY num_variants DESC;

-- 4. Query per vedere tutte le varianti correlate per ogni gruppo
SELECT 
    pr.id_related,
    p.name AS product_name,
    pv.id AS variant_id,
    pv.id_product AS product_id
FROM product_related pr
INNER JOIN product_variants pv ON pr.id_product_variant = pv.id
INNER JOIN products p ON pv.id_product = p.id
ORDER BY pr.id_related, p.name;

