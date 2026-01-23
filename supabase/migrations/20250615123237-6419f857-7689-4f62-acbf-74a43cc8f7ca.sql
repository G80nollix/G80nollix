
-- Annunci per Mario Bianchi
INSERT INTO products (
  id, user_id, title, description, category, subcategory, brand, model,
  location, address, delivery_home, pickup_on_site, delivery_area_km,
  price_hour, price_daily, price_weekly, price_month, deposit, payment_method,
  cancellation_policy, min_rent_duration, max_rent_duration, availability_days,
  dimensions, weight, power, capacity, specs, condition, return_conditions,
  renter_requirements, contact_person, contact_phone, contact_email,
  extra_services, terms, owner_type, company_id, images, video_url, status
)
VALUES
-- Prodotto 1: Bici elettrica per Mario Bianchi
(gen_random_uuid(), '39762279-851a-4b8f-a5df-223ec40bbb64', 
'E-Bike Yamaha', 'Bici elettrica perfetta per escursioni cittadine o fuori porta. Batteria lunga durata.', 
'Biciclette', 'Bici Elettrica', 'Yamaha', 'eUrban Pro', 
'Mantova', 'Via Roma 13', true, true, 20,
6, 35, 210, 700, 100, 'Contanti',
'Gratuita fino a 24h prima', 1, 15, ARRAY['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì'],
'170x60x110 cm', '22kg', null, null, 'Cambio Shimano, ruote 27,5"', 'Ottime condizioni',
'Restituzione pulita', 'Patente richiesta', 'Mario Bianchi', '3510000011', 'mbianchi@mail.com',
'Montaggio/smontaggio', 'Solo usi non professionali', 'utente', null,
ARRAY['/placeholder.svg','/placeholder.svg','/placeholder.svg'],
null, 'active'),

-- Prodotto 2: Sci per Mario Bianchi
(gen_random_uuid(), '39762279-851a-4b8f-a5df-223ec40bbb64', 
'Sci Rossignol Experience', 'Sci all-mountain gamma top, per sciatori esperti.', 
'Sci & Snowboard', 'Sci', 'Rossignol', 'Experience 84', 
'Trento', 'Via Vela 5', false, true, null,
10, 55, 330, 950, 200, 'Paypal',
'Non rimborsabile', 2, 10, ARRAY['Venerdì', 'Sabato', 'Domenica'],
'170 cm', '3,1kg', null, null, 'Attacco Look NX12', 'Buone condizioni',
'Nessun danno sul fondo', 'Documento identificativo', 'Mario Bianchi', '3510000011', 'mbianchi@mail.com',
'Assicurazione', 'Solo prenotazioni con anticipo', 'utente', null,
ARRAY['/placeholder.svg','/placeholder.svg','/placeholder.svg'],
null, 'active'),

-- Prodotto 3: Kayak per Mario Rossi
(gen_random_uuid(), 'd471d863-3888-461e-9ae1-9f112a5d26be',
'Kayak Sevylor gonfiabile', 'Kayak 2 posti, completo di pagaie e pompa di gonfiaggio.', 
'Sport Acquatici', 'Kayak', 'Sevylor', 'Adventure Plus',
'Peschiera d/Garda', null, true, true, 30,
9, 44, 250, null, 50, 'Bonifico',
'Gratuita fino a 48h prima', 1, 7, ARRAY['Sabato', 'Domenica'],
'390x90 cm', '15kg', null, '230kg', 'Set pagaie incluse', 'Come nuovo',
'Restituire asciutto', '≥18 anni', 'Mario Rossi', '3481111122', 'mrossi@mail.com',
'Assistenza sul campo', '', 'utente', null,
ARRAY['/placeholder.svg','/placeholder.svg','/placeholder.svg'],
null, 'active'),

-- Prodotto 4: Tenda Ferrino per Mario Rossi
(gen_random_uuid(), 'd471d863-3888-461e-9ae1-9f112a5d26be',
'Tenda Ferrino 3 posti', 'Tenda trekking leggera, montaggio rapido, ottimo per weekend in montagna.', 
'Campeggio', 'Tende', 'Ferrino', 'Lightent 3 Pro',
'Verona', null, false, true, null,
2, 15, 80, 220, 30, 'Carta di credito',
'Personalizzata', 1, 21, ARRAY['Lunedì', 'Martedì', 'Venerdì'],
'290x180x120 cm', '2,4kg', null, '3 persone', 'Picchetti titanio inclusi', 'Ottime condizioni',
'Restituzione senza strappi', 'Cauzione obbligatoria', 'Mario Rossi', '3481111122', 'mrossi@mail.com',
'', '', 'utente', null,
ARRAY['/placeholder.svg','/placeholder.svg','/placeholder.svg'],
null, 'active');
