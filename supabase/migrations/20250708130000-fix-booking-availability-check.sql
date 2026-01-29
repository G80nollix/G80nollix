-- Fix per il controllo della disponibilità delle prenotazioni
-- Il problema era che le policy RLS permettevano di vedere solo le proprie prenotazioni
-- Questo causava un bug dove un utente poteva prenotare un prodotto già prenotato da un altro utente

-- Aggiungiamo una policy per permettere la lettura di tutte le prenotazioni di un prodotto
-- per il controllo della disponibilità
CREATE POLICY "Anyone can view product bookings for availability check"
  ON public.bookings
  FOR SELECT
  USING (true);

-- Nota: questa policy permette a chiunque di leggere tutte le prenotazioni
-- Questo è necessario per il controllo della disponibilità
-- Le altre policy RLS continuano a proteggere le operazioni di INSERT, UPDATE, DELETE
