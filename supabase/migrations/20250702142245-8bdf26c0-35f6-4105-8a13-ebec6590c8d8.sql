
-- Inserimento di 20 utenti casuali nella tabella profiles
INSERT INTO public.profiles (id, email, first_name, last_name, phone, birth_date, user_type) VALUES
(gen_random_uuid(), 'mario.rossi@email.com', 'Mario', 'Rossi', '3331234567', '1985-03-15', 'individual'),
(gen_random_uuid(), 'giulia.bianchi@email.com', 'Giulia', 'Bianchi', '3332345678', '1990-07-22', 'individual'),
(gen_random_uuid(), 'luca.ferrari@email.com', 'Luca', 'Ferrari', '3333456789', '1988-11-08', 'individual'),
(gen_random_uuid(), 'francesca.romano@email.com', 'Francesca', 'Romano', '3334567890', '1992-04-12', 'individual'),
(gen_random_uuid(), 'alessandro.gallo@email.com', 'Alessandro', 'Gallo', '3335678901', '1987-09-30', 'individual'),
(gen_random_uuid(), 'sara.conti@email.com', 'Sara', 'Conti', '3336789012', '1991-01-18', 'individual'),
(gen_random_uuid(), 'davide.bruno@email.com', 'Davide', 'Bruno', '3337890123', '1989-06-25', 'individual'),
(gen_random_uuid(), 'elena.ricci@email.com', 'Elena', 'Ricci', '3338901234', '1993-12-03', 'individual'),
(gen_random_uuid(), 'matteo.greco@email.com', 'Matteo', 'Greco', '3339012345', '1986-05-14', 'individual'),
(gen_random_uuid(), 'chiara.marino@email.com', 'Chiara', 'Marino', '3330123456', '1994-08-27', 'individual'),
(gen_random_uuid(), 'federico.lombardi@email.com', 'Federico', 'Lombardi', '3341234567', '1984-10-11', 'individual'),
(gen_random_uuid(), 'valentina.costa@email.com', 'Valentina', 'Costa', '3342345678', '1995-02-09', 'individual'),
(gen_random_uuid(), 'simone.mancini@email.com', 'Simone', 'Mancini', '3343456789', '1983-07-16', 'individual'),
(gen_random_uuid(), 'martina.villa@email.com', 'Martina', 'Villa', '3344567890', '1996-11-21', 'individual'),
(gen_random_uuid(), 'antonio.serra@email.com', 'Antonio', 'Serra', '3345678901', '1982-04-05', 'individual'),
(gen_random_uuid(), 'laura.fontana@email.com', 'Laura', 'Fontana', '3346789012', '1997-09-13', 'individual'),
(gen_random_uuid(), 'roberto.caruso@email.com', 'Roberto', 'Caruso', '3347890123', '1981-01-28', 'individual'),
(gen_random_uuid(), 'silvia.rizzo@email.com', 'Silvia', 'Rizzo', '3348901234', '1998-06-07', 'individual'),
(gen_random_uuid(), 'andrea.moretti@email.com', 'Andrea', 'Moretti', '3349012345', '1980-12-19', 'individual'),
(gen_random_uuid(), 'paola.barbieri@email.com', 'Paola', 'Barbieri', '3350123456', '1999-03-24', 'individual');
