
-- Uniforma i valori di owner_type nei prodotti esistenti

-- Per "Privato"
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE 'privato';
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE 'privato%';
UPDATE products SET owner_type = 'Privato' WHERE owner_type = 'PRIVATO';

-- Per "Azienda"
UPDATE products SET owner_type = 'Azienda' WHERE owner_type ILIKE 'azienda';
UPDATE products SET owner_type = 'Azienda' WHERE owner_type ILIKE 'azienda%';
UPDATE products SET owner_type = 'Azienda' WHERE owner_type = 'AZIENDA';

-- Se ci sono spazi in più
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE '%privato%';
UPDATE products SET owner_type = 'Azienda' WHERE owner_type ILIKE '%azienda%';

