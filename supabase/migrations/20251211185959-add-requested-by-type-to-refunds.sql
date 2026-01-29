-- Aggiungi colonna requested_by_type alla tabella refunds
-- Questa colonna traccia se il rimborso è stato richiesto da un admin o da un utente

ALTER TABLE public.refunds
ADD COLUMN IF NOT EXISTS requested_by_type TEXT NOT NULL DEFAULT 'user' 
  CHECK (requested_by_type IN ('admin', 'user'));

-- Rimuovi il DEFAULT dopo l'aggiunta (perché vogliamo che sia sempre specificato)
-- Nota: questo comando fallirà se ci sono già righe nella tabella, 
-- quindi lo eseguiamo solo se la tabella è vuota o se vogliamo mantenere il default
-- ALTER TABLE public.refunds ALTER COLUMN requested_by_type DROP DEFAULT;

