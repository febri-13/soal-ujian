-- =============================================================================
-- PSAT SMP Al Abidin — Initial Schema (psat)
-- =============================================================================
-- Schema ini terpisah dari `public` agar tidak konflik dengan project lain
-- (mis. lms-new) yang share Supabase project yang sama.
--
-- Cara apply:
--   pnpm db:migrate
-- atau:
--   psql "$DATABASE_URL" -f supabase/migrations/20260503000000_init_psat_schema.sql
-- atau paste manual di Supabase Dashboard → SQL Editor
--
-- SETELAH APPLY: tambahkan `psat` ke "Exposed schemas" di
-- Supabase Dashboard → Settings → API
-- =============================================================================

BEGIN;

-- 1. Buat schema
CREATE SCHEMA IF NOT EXISTS psat;

-- 2. Beri akses ke role Supabase
GRANT USAGE ON SCHEMA psat TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA psat TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA psat TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA psat TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA psat
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA psat
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA psat
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- =============================================================================
-- ENUMS (idempotent via DO block)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE psat.user_role AS ENUM ('guru', 'validator', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE psat.doc_status AS ENUM (
    'belum_upload', 'under_review', 'approved', 'needs_revision'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE psat.soal_status AS ENUM (
    'draft', 'submitted', 'approved', 'needs_revision'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- Profiles: linked ke auth.users (Supabase Auth tetap dipakai)
-- Password user = nomor HP ternormalisasi (contoh: 628123456789)
CREATE TABLE IF NOT EXISTS psat.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  no_hp TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  role psat.user_role NOT NULL DEFAULT 'guru',
  kelas TEXT,
  unit_sekolah TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON psat.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_no_hp ON psat.profiles(no_hp);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON psat.profiles(role);

-- Mata Pelajaran
CREATE TABLE IF NOT EXISTS psat.mata_pelajaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  kode TEXT,
  deskripsi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data tambahan guru (rekening, bank, dll)
CREATE TABLE IF NOT EXISTS psat.psat_guru_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES psat.profiles(id) ON DELETE CASCADE,
  no_rekening TEXT,
  bank TEXT,
  mapel_id UUID REFERENCES psat.mata_pelajaran(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- Patokan soal per (guru × mapel × tipe × kesulitan)
CREATE TABLE IF NOT EXISTS psat.psat_patokan_soal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES psat.profiles(id) ON DELETE CASCADE,
  mapel_id UUID REFERENCES psat.mata_pelajaran(id),
  tipe TEXT NOT NULL,
  tingkat_kesulitan TEXT NOT NULL,
  keluar TEXT NOT NULL,
  bank TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matrix pemetaan soal per bab (bab_id berupa text bebas)
CREATE TABLE IF NOT EXISTS psat.psat_matrix_input (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES psat.profiles(id) ON DELETE CASCADE,
  bab_id_text TEXT NOT NULL,
  data JSONB NOT NULL,
  is_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matrix_profile ON psat.psat_matrix_input(profile_id);
CREATE INDEX IF NOT EXISTS idx_matrix_submitted ON psat.psat_matrix_input(is_submitted);

-- Bank soal
CREATE TABLE IF NOT EXISTS psat.bank_soal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pertanyaan TEXT NOT NULL,
  tipe TEXT NOT NULL,
  mata_pelajaran_id UUID REFERENCES psat.mata_pelajaran(id),
  guru_id UUID REFERENCES psat.profiles(id) ON DELETE CASCADE,
  bab_id_text TEXT,
  level TEXT,
  bobot NUMERIC(4,2) DEFAULT 1,
  tingkat_kesulitan TEXT DEFAULT 'sedang',
  tags TEXT[],
  gambar_url TEXT,
  pilihan JSONB,
  jawaban_benar JSONB,
  status psat.soal_status NOT NULL DEFAULT 'draft',
  revision_notes TEXT,
  items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soal_guru ON psat.bank_soal(guru_id);
CREATE INDEX IF NOT EXISTS idx_soal_status ON psat.bank_soal(status);
CREATE INDEX IF NOT EXISTS idx_soal_mapel ON psat.bank_soal(mata_pelajaran_id);

-- Status dokumen (kisi-kisi, glossary, naskah)
CREATE TABLE IF NOT EXISTS psat.psat_dokumen_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES psat.profiles(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL,
  file_url TEXT,
  status psat.doc_status NOT NULL DEFAULT 'belum_upload',
  versi INTEGER DEFAULT 1,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, tipe)
);

-- Tracking image hash (deduplication upload)
CREATE TABLE IF NOT EXISTS psat.psat_image_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES psat.profiles(id) ON DELETE SET NULL,
  hash TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log login (gratis, berguna kalau ada incident)
CREATE TABLE IF NOT EXISTS psat.login_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_log_email ON psat.login_log(email);
CREATE INDEX IF NOT EXISTS idx_login_log_created ON psat.login_log(created_at DESC);

-- =============================================================================
-- TRIGGER: auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION psat.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON psat.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON psat.profiles
  FOR EACH ROW EXECUTE FUNCTION psat.set_updated_at();

DROP TRIGGER IF EXISTS trg_guru_data_updated_at ON psat.psat_guru_data;
CREATE TRIGGER trg_guru_data_updated_at
  BEFORE UPDATE ON psat.psat_guru_data
  FOR EACH ROW EXECUTE FUNCTION psat.set_updated_at();

DROP TRIGGER IF EXISTS trg_patokan_updated_at ON psat.psat_patokan_soal;
CREATE TRIGGER trg_patokan_updated_at
  BEFORE UPDATE ON psat.psat_patokan_soal
  FOR EACH ROW EXECUTE FUNCTION psat.set_updated_at();

DROP TRIGGER IF EXISTS trg_matrix_updated_at ON psat.psat_matrix_input;
CREATE TRIGGER trg_matrix_updated_at
  BEFORE UPDATE ON psat.psat_matrix_input
  FOR EACH ROW EXECUTE FUNCTION psat.set_updated_at();

DROP TRIGGER IF EXISTS trg_bank_soal_updated_at ON psat.bank_soal;
CREATE TRIGGER trg_bank_soal_updated_at
  BEFORE UPDATE ON psat.bank_soal
  FOR EACH ROW EXECUTE FUNCTION psat.set_updated_at();

DROP TRIGGER IF EXISTS trg_dokumen_updated_at ON psat.psat_dokumen_status;
CREATE TRIGGER trg_dokumen_updated_at
  BEFORE UPDATE ON psat.psat_dokumen_status
  FOR EACH ROW EXECUTE FUNCTION psat.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE psat.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE psat.psat_guru_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE psat.psat_patokan_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE psat.psat_matrix_input ENABLE ROW LEVEL SECURITY;
ALTER TABLE psat.bank_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE psat.psat_dokumen_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE psat.psat_image_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE psat.mata_pelajaran ENABLE ROW LEVEL SECURITY;

-- Helper: cek role user dari profiles
CREATE OR REPLACE FUNCTION psat.current_user_role()
RETURNS psat.user_role AS $$
  SELECT role FROM psat.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles: user lihat profile sendiri, validator/admin lihat semua
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON psat.profiles;
CREATE POLICY "profiles_select_own_or_staff" ON psat.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR psat.current_user_role() IN ('validator', 'admin')
  );

DROP POLICY IF EXISTS "profiles_insert_self" ON psat.profiles;
CREATE POLICY "profiles_insert_self" ON psat.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON psat.profiles;
CREATE POLICY "profiles_update_own" ON psat.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_all" ON psat.profiles;
CREATE POLICY "profiles_admin_all" ON psat.profiles
  FOR ALL USING (psat.current_user_role() = 'admin');

-- Guru data: hanya pemilik + admin
DROP POLICY IF EXISTS "guru_data_own" ON psat.psat_guru_data;
CREATE POLICY "guru_data_own" ON psat.psat_guru_data
  FOR ALL USING (
    auth.uid() = profile_id
    OR psat.current_user_role() = 'admin'
  );

-- Patokan: pemilik + validator/admin
DROP POLICY IF EXISTS "patokan_own_or_staff" ON psat.psat_patokan_soal;
CREATE POLICY "patokan_own_or_staff" ON psat.psat_patokan_soal
  FOR ALL USING (
    auth.uid() = profile_id
    OR psat.current_user_role() IN ('validator', 'admin')
  );

-- Matrix: pemilik + validator/admin
DROP POLICY IF EXISTS "matrix_own_or_staff" ON psat.psat_matrix_input;
CREATE POLICY "matrix_own_or_staff" ON psat.psat_matrix_input
  FOR ALL USING (
    auth.uid() = profile_id
    OR psat.current_user_role() IN ('validator', 'admin')
  );

-- Bank soal
DROP POLICY IF EXISTS "soal_select" ON psat.bank_soal;
CREATE POLICY "soal_select" ON psat.bank_soal
  FOR SELECT USING (
    auth.uid() = guru_id
    OR psat.current_user_role() IN ('validator', 'admin')
  );

DROP POLICY IF EXISTS "soal_insert_own" ON psat.bank_soal;
CREATE POLICY "soal_insert_own" ON psat.bank_soal
  FOR INSERT WITH CHECK (auth.uid() = guru_id);

DROP POLICY IF EXISTS "soal_update_own_or_staff" ON psat.bank_soal;
CREATE POLICY "soal_update_own_or_staff" ON psat.bank_soal
  FOR UPDATE USING (
    auth.uid() = guru_id
    OR psat.current_user_role() IN ('validator', 'admin')
  );

DROP POLICY IF EXISTS "soal_delete_own_draft" ON psat.bank_soal;
CREATE POLICY "soal_delete_own_draft" ON psat.bank_soal
  FOR DELETE USING (
    auth.uid() = guru_id AND status = 'draft'
  );

-- Dokumen status: pemilik + validator/admin
DROP POLICY IF EXISTS "dokumen_own_or_staff" ON psat.psat_dokumen_status;
CREATE POLICY "dokumen_own_or_staff" ON psat.psat_dokumen_status
  FOR ALL USING (
    auth.uid() = profile_id
    OR psat.current_user_role() IN ('validator', 'admin')
  );

-- Image uploads: pemilik + admin
DROP POLICY IF EXISTS "image_own" ON psat.psat_image_uploads;
CREATE POLICY "image_own" ON psat.psat_image_uploads
  FOR ALL USING (
    auth.uid() = profile_id
    OR psat.current_user_role() = 'admin'
  );

-- Mata pelajaran: read public, write admin
DROP POLICY IF EXISTS "mapel_read" ON psat.mata_pelajaran;
CREATE POLICY "mapel_read" ON psat.mata_pelajaran
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "mapel_admin_write" ON psat.mata_pelajaran;
CREATE POLICY "mapel_admin_write" ON psat.mata_pelajaran
  FOR ALL USING (psat.current_user_role() = 'admin');

COMMIT;
