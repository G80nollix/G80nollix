
-- Aggiunta campi prodotti per la scheda completa come richiesto

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS delivery_home BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_on_site BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_area_km INTEGER,
  ADD COLUMN IF NOT EXISTS price_hour NUMERIC,
  ADD COLUMN IF NOT EXISTS price_month NUMERIC,
  ADD COLUMN IF NOT EXISTS deposit NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
  ADD COLUMN IF NOT EXISTS min_rent_duration INTEGER,
  ADD COLUMN IF NOT EXISTS max_rent_duration INTEGER,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT,
  ADD COLUMN IF NOT EXISTS power TEXT,
  ADD COLUMN IF NOT EXISTS capacity TEXT,
  ADD COLUMN IF NOT EXISTS specs TEXT,
  ADD COLUMN IF NOT EXISTS return_conditions TEXT,
  ADD COLUMN IF NOT EXISTS renter_requirements TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS extra_services TEXT,
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS owner_type TEXT,
  ADD COLUMN IF NOT EXISTS company_id UUID;

-- Note:
-- 1. owner_type: 'azienda' o 'utente'
-- 2. company_id: opzionale, valorizzato per prodotti di azienda (collega alla profiles con user_type azienda)
-- 3. images array già supporta almeno 3 foto (controllo via frontend)
-- 4. video_url: per link a video
-- 5. delivery_area_km: per area di copertura in km
-- 6. min_rent_duration/max_rent_duration: in giorni/ore, da specificare a livello UI
-- 7. Altre colonne sono stringhe flessibili o numeriche a seconda del campo

