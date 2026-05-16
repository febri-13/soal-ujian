-- Bucket untuk dokumen (kisi-kisi, glossary)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dokumen-psat', 'dokumen-psat', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket untuk gambar soal
INSERT INTO storage.buckets (id, name, public)
VALUES ('soal-images', 'soal-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies: dokumen-psat
DROP POLICY IF EXISTS "dokumen_upload" ON storage.objects;
CREATE POLICY "dokumen_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dokumen-psat' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "dokumen_read" ON storage.objects;
CREATE POLICY "dokumen_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'dokumen-psat');

DROP POLICY IF EXISTS "dokumen_delete" ON storage.objects;
CREATE POLICY "dokumen_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'dokumen-psat' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS policies: soal-images
DROP POLICY IF EXISTS "images_upload" ON storage.objects;
CREATE POLICY "images_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'soal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "images_read" ON storage.objects;
CREATE POLICY "images_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'soal-images');

DROP POLICY IF EXISTS "images_delete" ON storage.objects;
CREATE POLICY "images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'soal-images' AND (storage.foldername(name))[1] = auth.uid()::text);
