
-- Rimuovi la colonna owner_type dalla tabella products
ALTER TABLE products DROP COLUMN IF EXISTS owner_type;

-- Aggiungi la nuova colonna delivery_type per gestire "Ritiro in sede" o "Consegna"
ALTER TABLE products ADD COLUMN delivery_type TEXT DEFAULT 'pickup';

-- Aggiorna i prodotti esistenti con valori casuali
UPDATE products 
SET delivery_type = CASE 
  WHEN RANDOM() < 0.5 THEN 'pickup'
  ELSE 'delivery'
END
WHERE delivery_type IS NULL OR delivery_type = 'pickup';

-- Aggiungi un constraint per assicurarsi che il valore sia valido
ALTER TABLE products ADD CONSTRAINT products_delivery_type_check 
CHECK (delivery_type IN ('pickup', 'delivery'));
