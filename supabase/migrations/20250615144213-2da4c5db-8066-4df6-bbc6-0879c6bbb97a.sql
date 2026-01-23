
-- Aggiungi la gestione della fascia oraria alle prenotazioni
ALTER TABLE public.bookings
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME;

-- Aggiorna le policy per gestire i nuovi campi (le policy già coprono i permessi utente)
