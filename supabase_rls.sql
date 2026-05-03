-- Enable RLS on all tables

-- 1. profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);


-- 2. mata_pelajaran table
ALTER TABLE mata_pelajaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read mata_pelajaran" ON mata_pelajaran;
DROP POLICY IF EXISTS "Authenticated can insert mata_pelajaran" ON mata_pelajaran;
DROP POLICY IF EXISTS "Owner can update mata_pelajaran" ON mata_pelajaran;
DROP POLICY IF EXISTS "Owner can delete mata_pelajaran" ON mata_pelajaran;

CREATE POLICY "Anyone can read mata_pelajaran" ON mata_pelajaran
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert mata_pelajaran" ON mata_pelajaran
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owner can update mata_pelajaran" ON mata_pelajaran
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Owner can delete mata_pelajaran" ON mata_pelajaran
  FOR DELETE USING (auth.uid() = id);


-- 3. bab_pelajaran table
ALTER TABLE bab_pelajaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bab_pelajaran" ON bab_pelajaran;
DROP POLICY IF EXISTS "Authenticated can insert bab_pelajaran" ON bab_pelajaran;
DROP POLICY IF EXISTS "Owner can update bab_pelajaran" ON bab_pelajaran;
DROP POLICY IF EXISTS "Owner can delete bab_pelajaran" ON bab_pelajaran;

CREATE POLICY "Anyone can read bab_pelajaran" ON bab_pelajaran
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert bab_pelajaran" ON bab_pelajaran
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owner can update bab_pelajaran" ON bab_pelajaran
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Owner can delete bab_pelajaran" ON bab_pelajaran
  FOR DELETE USING (auth.uid() = id);


-- 4. bank_soal table
ALTER TABLE bank_soal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bank_soal" ON bank_soal;
DROP POLICY IF EXISTS "Authenticated can insert bank_soal" ON bank_soal;
DROP POLICY IF EXISTS "Owner can update bank_soal" ON bank_soal;
DROP POLICY IF EXISTS "Owner can delete bank_soal" ON bank_soal;

CREATE POLICY "Anyone can read bank_soal" ON bank_soal
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert bank_soal" ON bank_soal
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owner can update bank_soal" ON bank_soal
  FOR UPDATE USING (auth.uid() = guru_id);

CREATE POLICY "Admin can update bank_soal" ON bank_soal
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'validator'))
  );

CREATE POLICY "Owner can delete bank_soal" ON bank_soal
  FOR DELETE USING (auth.uid() = guru_id);


-- 5. psat_guru_data table
ALTER TABLE psat_guru_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read psat_guru_data" ON psat_guru_data;
DROP POLICY IF EXISTS "Owner can insert psat_guru_data" ON psat_guru_data;
DROP POLICY IF EXISTS "Owner can update psat_guru_data" ON psat_guru_data;
DROP POLICY IF EXISTS "Owner can delete psat_guru_data" ON psat_guru_data;

CREATE POLICY "Owner can read psat_guru_data" ON psat_guru_data
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Owner can insert psat_guru_data" ON psat_guru_data
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Owner can update psat_guru_data" ON psat_guru_data
  FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Owner can delete psat_guru_data" ON psat_guru_data
  FOR DELETE USING (auth.uid() = profile_id);


-- 6. psat_patokan_soal table
ALTER TABLE psat_patokan_soal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read psat_patokan_soal" ON psat_patokan_soal;
DROP POLICY IF EXISTS "Owner can insert psat_patokan_soal" ON psat_patokan_soal;
DROP POLICY IF EXISTS "Owner can update psat_patokan_soal" ON psat_patokan_soal;
DROP POLICY IF EXISTS "Owner can delete psat_patokan_soal" ON psat_patokan_soal;

CREATE POLICY "Owner can read psat_patokan_soal" ON psat_patokan_soal
  FOR SELECT USING (auth.uid() = profile_id OR profile_id IS NULL);

CREATE POLICY "Owner can insert psat_patokan_soal" ON psat_patokan_soal
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Owner can update psat_patokan_soal" ON psat_patokan_soal
  FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Owner can delete psat_patokan_soal" ON psat_patokan_soal
  FOR DELETE USING (auth.uid() = profile_id);


-- 7. psat_matrix_input table
ALTER TABLE psat_matrix_input ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read psat_matrix_input" ON psat_matrix_input;
DROP POLICY IF EXISTS "Owner can insert psat_matrix_input" ON psat_matrix_input;
DROP POLICY IF EXISTS "Owner can update psat_matrix_input" ON psat_matrix_input;
DROP POLICY IF EXISTS "Owner can delete psat_matrix_input" ON psat_matrix_input;

CREATE POLICY "Owner can read psat_matrix_input" ON psat_matrix_input
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Owner can insert psat_matrix_input" ON psat_matrix_input
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Owner can update psat_matrix_input" ON psat_matrix_input
  FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Owner can delete psat_matrix_input" ON psat_matrix_input
  FOR DELETE USING (auth.uid() = profile_id);


-- 8. psat_dokumen_status table
ALTER TABLE psat_dokumen_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read psat_dokumen_status" ON psat_dokumen_status;
DROP POLICY IF EXISTS "Owner can insert psat_dokumen_status" ON psat_dokumen_status;
DROP POLICY IF EXISTS "Owner can update psat_dokumen_status" ON psat_dokumen_status;
DROP POLICY IF EXISTS "Owner can delete psat_dokumen_status" ON psat_dokumen_status;

CREATE POLICY "Owner can read psat_dokumen_status" ON psat_dokumen_status
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Owner can insert psat_dokumen_status" ON psat_dokumen_status
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Owner can update psat_dokumen_status" ON psat_dokumen_status
  FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Owner can delete psat_dokumen_status" ON psat_dokumen_status
  FOR DELETE USING (auth.uid() = profile_id);


-- Migration: Insert profiles for existing auth users
INSERT INTO profiles (id, email, nama, username, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'nama',
  au.raw_user_meta_data->>'username',
  COALESCE(au.created_at, NOW()),
  COALESCE(au.updated_at, NOW())
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
AND au.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;