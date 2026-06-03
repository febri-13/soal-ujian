-- Tambah p_profile_id ke RPC get_public_matrix_by_mapel
-- agar matrix yang tampil hanya milik akun guru tertentu

DROP FUNCTION IF EXISTS psat.get_public_matrix_by_mapel(UUID);

CREATE OR REPLACE FUNCTION psat.get_public_matrix_by_mapel(p_mapel_id UUID, p_profile_id UUID)
RETURNS TABLE (
  bab_id_text TEXT,
  data        JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = psat, public
AS $$
  SELECT mi.bab_id_text, mi.data
  FROM psat.psat_matrix_input mi
  JOIN psat.psat_guru_data gd ON gd.profile_id = mi.profile_id
  WHERE gd.mapel_id = p_mapel_id
    AND mi.profile_id = p_profile_id
    AND mi.is_submitted = true
  ORDER BY mi.bab_id_text
$$;

GRANT EXECUTE ON FUNCTION psat.get_public_matrix_by_mapel(UUID, UUID) TO anon;
