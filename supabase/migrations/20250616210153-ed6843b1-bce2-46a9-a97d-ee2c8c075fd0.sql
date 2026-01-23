
-- Crea le politiche RLS per il bucket "immagini"
-- Permetti agli utenti autenticati di caricare file
CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'immagini' 
    AND auth.role() = 'authenticated'
  );

-- Permetti a tutti di visualizzare le immagini (lettura pubblica)
CREATE POLICY "Public can view images" ON storage.objects
  FOR SELECT 
  USING (bucket_id = 'immagini');

-- Permetti agli utenti di aggiornare le proprie immagini
CREATE POLICY "Users can update own images" ON storage.objects
  FOR UPDATE 
  USING (
    bucket_id = 'immagini' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Permetti agli utenti di eliminare le proprie immagini
CREATE POLICY "Users can delete own images" ON storage.objects
  FOR DELETE 
  USING (
    bucket_id = 'immagini' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
