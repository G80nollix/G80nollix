
-- Cambia il nome del primo prodotto attivo in "Avvitatore"
UPDATE products 
SET title = 'Avvitatore'
WHERE status = 'active' 
AND id = (
  SELECT id 
  FROM products 
  WHERE status = 'active' 
  ORDER BY created_at ASC 
  LIMIT 1
);
