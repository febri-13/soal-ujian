-- Tambah kolom yang dipakai profile page tapi belum ada di psat_guru_data
ALTER TABLE psat.psat_guru_data
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS unit_sekolah TEXT;

-- Ganti FOR ALL USING dengan policy eksplisit per operasi agar INSERT
-- benar-benar ter-authorize (FOR ALL kadang tidak men-cover INSERT di Supabase)
DROP POLICY IF EXISTS "guru_data_own" ON psat.psat_guru_data;

CREATE POLICY "guru_data_select" ON psat.psat_guru_data
  FOR SELECT USING (
    auth.uid() = profile_id
    OR psat.current_user_role() = 'admin'
  );

CREATE POLICY "guru_data_insert" ON psat.psat_guru_data
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "guru_data_update" ON psat.psat_guru_data
  FOR UPDATE USING (
    auth.uid() = profile_id
    OR psat.current_user_role() = 'admin'
  );

CREATE POLICY "guru_data_delete" ON psat.psat_guru_data
  FOR DELETE USING (
    auth.uid() = profile_id
    OR psat.current_user_role() = 'admin'
  );

-- Tambah WITH CHECK ke update policy profiles agar lebih eksplisit
DROP POLICY IF EXISTS "profiles_update_own" ON psat.profiles;
CREATE POLICY "profiles_update_own" ON psat.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
