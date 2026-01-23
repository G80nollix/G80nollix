-- Aggiorna la tabella informations:
-- NOTA: I campi obbligatori sono stati impostati manualmente per i campi visibili:
-- Nome, Data di nascita, Peso, Altezza, Piede
-- Questa migrazione si assicura solo che il campo "Nome" punti correttamente a "first_name" della tabella profiles

-- Aggiorna il campo "Nome" per puntare a "first_name" della tabella profiles
-- Cerca il campo che ha name = 'Nome' o name = 'Cognome' (che deve diventare Nome)
-- e imposta profile_field_link = 'first_name'
UPDATE public.informations
SET profile_field_link = 'first_name'
WHERE (LOWER(name) = 'nome' OR LOWER(name) = 'cognome')
  AND (profile_field_link IS NULL OR profile_field_link != 'first_name');

-- Verifica che il campo Nome esista e abbia il link corretto
-- Se esiste un campo "Cognome", aggiornalo a "Nome" con il profile_field_link corretto
DO $$
DECLARE
  nome_field_id UUID;
  cognome_field_id UUID;
BEGIN
  -- Cerca un campo con name = 'nome'
  SELECT id INTO nome_field_id
  FROM public.informations
  WHERE LOWER(name) = 'nome'
  LIMIT 1;
  
  -- Cerca un campo con name = 'cognome'
  SELECT id INTO cognome_field_id
  FROM public.informations
  WHERE LOWER(name) = 'cognome'
  LIMIT 1;
  
  -- Se esiste un campo "Cognome" e non esiste un campo "Nome", 
  -- aggiorna "Cognome" a "Nome" con il profile_field_link corretto
  IF cognome_field_id IS NOT NULL AND nome_field_id IS NULL THEN
    UPDATE public.informations
    SET 
      profile_field_link = 'first_name',
      name = 'Nome'
    WHERE id = cognome_field_id;
  -- Se esiste un campo "Nome", assicura che abbia il profile_field_link corretto
  ELSIF nome_field_id IS NOT NULL THEN
    UPDATE public.informations
    SET profile_field_link = 'first_name'
    WHERE id = nome_field_id
      AND (profile_field_link IS NULL OR profile_field_link != 'first_name');
  END IF;
END $$;

-- Aggiungi commento per documentazione
COMMENT ON COLUMN public.informations.required IS 'Campo obbligatorio - impostato manualmente per i campi visibili: Nome, Data di nascita, Peso, Altezza, Piede';
COMMENT ON COLUMN public.informations.profile_field_link IS 'Nome del campo della tabella profiles per pre-compilazione (es: first_name, last_name, birth_date)';

