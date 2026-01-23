
-- Aggiorna i valori old->new per il campo "condition" nei prodotti in modo che coincidano con le nuove opzioni
UPDATE products SET condition = 'Come nuovo' WHERE condition = 'Nuove';
UPDATE products SET condition = 'Ottime condizioni' WHERE condition = 'Ottime';
UPDATE products SET condition = 'Buone condizioni' WHERE condition = 'Buone';
UPDATE products SET condition = 'Condizioni discrete' WHERE condition = 'Discrete';

-- Opzionale: uniforma eventuali varianti con spazi e maiuscole/minuscole
UPDATE products SET condition = 'Ottime condizioni' WHERE condition ILIKE 'ottime condizioni';
UPDATE products SET condition = 'Buone condizioni' WHERE condition ILIKE 'buone condizioni';
UPDATE products SET condition = 'Condizioni discrete' WHERE condition ILIKE 'condizioni discrete';
UPDATE products SET condition = 'Come nuovo' WHERE condition ILIKE 'come nuovo';
