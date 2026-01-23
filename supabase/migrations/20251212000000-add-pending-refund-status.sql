-- Aggiungi status 'pendingRefund' alla tabella bookings
-- Questo status indica che è stata richiesta una procedura di rimborso

-- Verifica se esiste un constraint CHECK per lo status e aggiornalo
DO $$
BEGIN
  -- Rimuovi il constraint esistente se presente
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'bookings_status_check'
  ) THEN
    ALTER TABLE public.bookings 
    DROP CONSTRAINT bookings_status_check;
  END IF;
  
  -- Aggiungi il nuovo constraint con 'pendingRefund' e 'succeededRefund'
  ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('cart', 'confirmed', 'cancelled', 'completed', 'inPayment', 'pendingRefund', 'succeededRefund'));
END $$;










