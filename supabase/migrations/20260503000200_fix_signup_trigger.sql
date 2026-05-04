-- =============================================================================
-- Fix signup triggers:
--   1. create_profile_on_signup (lms-new) → tambah EXCEPTION agar tidak crash
--      untuk user psat yang tidak punya kolom public.profiles
--   2. psat.create_psat_profile_on_signup → trigger baru khusus psat.profiles,
--      auto-insert saat user daftar via psat app (ditandai dengan no_hp di metadata)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Patch trigger lms-new agar tidak crash untuk user psat
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO profiles (id, email, nama, role, kelas, nis, username)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nama',
    COALESCE(NEW.raw_user_meta_data->>'role', 'siswa')::user_role,
    NEW.raw_user_meta_data->>'kelas',
    NEW.raw_user_meta_data->>'nis',
    NEW.raw_user_meta_data->>'username'
  )
  ON CONFLICT (id) DO UPDATE SET
    email    = EXCLUDED.email,
    nama     = COALESCE(EXCLUDED.nama,     profiles.nama),
    kelas    = COALESCE(EXCLUDED.kelas,    profiles.kelas),
    nis      = COALESCE(EXCLUDED.nis,      profiles.nis),
    username = COALESCE(EXCLUDED.username, profiles.username);
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- User bukan lms-new (mis. psat) — lewati, auth tetap jalan
  RETURN NEW;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Trigger baru: auto-insert psat.profiles
--    Hanya jalan kalau metadata punya 'no_hp' (penanda user psat)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION psat.create_psat_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_no_hp TEXT;
  v_role  TEXT;
  v_unit  TEXT;
BEGIN
  v_no_hp := NEW.raw_user_meta_data->>'no_hp';

  -- Bukan user psat, lewati
  IF v_no_hp IS NULL THEN
    RETURN NEW;
  END IF;

  v_role := COALESCE(NEW.raw_user_meta_data->>'psat_role', 'guru');
  v_unit := NEW.raw_user_meta_data->>'unit_sekolah';

  INSERT INTO psat.profiles (id, email, no_hp, nama, role, unit_sekolah)
  VALUES (
    NEW.id,
    NEW.email,
    v_no_hp,
    NEW.raw_user_meta_data->>'nama',
    v_role::psat.user_role,
    v_unit
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    no_hp        = EXCLUDED.no_hp,
    nama         = COALESCE(EXCLUDED.nama,         psat.profiles.nama),
    role         = EXCLUDED.role,
    unit_sekolah = COALESCE(EXCLUDED.unit_sekolah, psat.profiles.unit_sekolah);

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_create_psat_profile_on_signup ON auth.users;
CREATE TRIGGER trg_create_psat_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION psat.create_psat_profile_on_signup();

COMMIT;
