
-- Uniforma owner_type nei prodotti includendo anche 'utente', 'user', ecc.
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE 'utente';
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE 'utente%';
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE '%utente%';
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE 'user';
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE 'user%';
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE '%user%';

-- Ripassa comunque anche i filtri già dati per robustezza
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE 'privato';
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE 'privato%';
UPDATE products SET owner_type = 'Privato' WHERE owner_type ILIKE '%privato%';
UPDATE products SET owner_type = 'Privato' WHERE owner_type = 'PRIVATO';
UPDATE products SET owner_type = 'Azienda' WHERE owner_type ILIKE 'azienda';
UPDATE products SET owner_type = 'Azienda' WHERE owner_type ILIKE 'azienda%';
UPDATE products SET owner_type = 'Azienda' WHERE owner_type ILIKE '%azienda%';
UPDATE products SET owner_type = 'Azienda' WHERE owner_type = 'AZIENDA';
