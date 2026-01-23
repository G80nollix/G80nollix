
-- Aggiungi il tipo di utente
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type TEXT CHECK (user_type IN ('individual', 'company')) DEFAULT 'individual';

-- Campi specifici per utenti privati
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tax_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS identity_document_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tax_code_document_url TEXT;

-- Campi specifici per aziende
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_postal_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_province TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_representative TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_sector TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- Crea bucket sicuro per documenti (se non già creato)
INSERT INTO storage.buckets (id, name, public)
SELECT 'user-documents', 'user-documents', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'user-documents');

-- Politiche RLS per la sicurezza dei documenti (ignore errors if already exist)
DO $$
BEGIN
  BEGIN
    CREATE POLICY "Users can view own documents" ON storage.objects
      FOR SELECT USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "Users can upload own documents" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "Users can update own documents" ON storage.objects
      FOR UPDATE USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "Users can delete own documents" ON storage.objects
      FOR DELETE USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END;
$$;
