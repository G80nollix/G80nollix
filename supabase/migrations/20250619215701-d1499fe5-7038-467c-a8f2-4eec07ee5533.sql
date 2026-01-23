
-- Elimina tutti i dati dalle tabelle
DELETE FROM public.bookings;
DELETE FROM public.products;

-- Reset delle sequenze se necessario
SELECT setval(pg_get_serial_sequence('public.products', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.bookings', 'id'), 1, false);

-- Crea il bucket per le immagini se non esiste già
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 
  'product-images', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Crea le politiche per il bucket delle immagini
CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT 
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their product images" ON storage.objects
  FOR UPDATE 
  USING (
    bucket_id = 'product-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their product images" ON storage.objects
  FOR DELETE 
  USING (
    bucket_id = 'product-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
