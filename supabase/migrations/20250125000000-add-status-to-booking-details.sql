-- Aggiungi il campo status alla tabella booking_details
-- Lo status può essere: 'to_pickup', 'picked_up', 'to_return', 'returned', ecc.

-- Aggiungi la colonna status se non esiste già
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'booking_details' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.booking_details
    ADD COLUMN status TEXT DEFAULT NULL;
    
    -- Aggiungi un commento per documentare i possibili valori
    COMMENT ON COLUMN public.booking_details.status IS 'Status del dettaglio prenotazione: to_pickup, picked_up, to_return, returned, ecc.';
  END IF;
END $$;

