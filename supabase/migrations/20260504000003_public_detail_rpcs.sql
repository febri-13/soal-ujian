-- =============================================================================
-- Update get_public_mapel_progress to include document URLs
-- =============================================================================

DROP FUNCTION IF EXISTS psat.get_public_mapel_progress();

CREATE OR REPLACE FUNCTION psat.get_public_mapel_progress()
RETURNS TABLE (
  mapel_id        UUID,
  mapel_nama      TEXT,
  mapel_kode      TEXT,
  guru_nama       TEXT,
  total           BIGINT,
  approved        BIGINT,
  submitted       BIGINT,
  draft           BIGINT,
  needs_revision  BIGINT,
  glossary_url    TEXT,
  kisi_kisi_url   TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = psat, public
AS $$
  SELECT
    mp.id                                                      AS mapel_id,
    mp.nama                                                    AS mapel_nama,
    mp.kode                                                    AS mapel_kode,
    (
      SELECT p2.nama
      FROM psat.psat_guru_data gd2
      JOIN psat.profiles p2 ON p2.id = gd2.profile_id
      WHERE gd2.mapel_id = mp.id
      ORDER BY gd2.created_at ASC
      LIMIT 1
    )                                                          AS guru_nama,
    COUNT(bs.id)                                               AS total,
    COUNT(bs.id) FILTER (WHERE bs.status = 'approved')        AS approved,
    COUNT(bs.id) FILTER (WHERE bs.status = 'submitted')       AS submitted,
    COUNT(bs.id) FILTER (WHERE bs.status = 'draft')           AS draft,
    COUNT(bs.id) FILTER (WHERE bs.status = 'needs_revision')  AS needs_revision,
    (
      SELECT ds.file_url
      FROM psat.psat_dokumen_status ds
      JOIN psat.psat_guru_data gd3 ON gd3.profile_id = ds.profile_id
      WHERE gd3.mapel_id = mp.id AND ds.tipe = 'glossary'
      LIMIT 1
    )                                                          AS glossary_url,
    (
      SELECT ds.file_url
      FROM psat.psat_dokumen_status ds
      JOIN psat.psat_guru_data gd4 ON gd4.profile_id = ds.profile_id
      WHERE gd4.mapel_id = mp.id AND ds.tipe = 'kisi_kisi'
      LIMIT 1
    )                                                          AS kisi_kisi_url
  FROM psat.mata_pelajaran mp
  LEFT JOIN psat.bank_soal bs ON bs.mata_pelajaran_id = mp.id
  GROUP BY mp.id, mp.nama, mp.kode
  ORDER BY mp.nama ASC
$$;

GRANT EXECUTE ON FUNCTION psat.get_public_mapel_progress() TO anon;

-- =============================================================================
-- Public: soal list per mapel (only approved, no answers exposed)
-- =============================================================================

CREATE OR REPLACE FUNCTION psat.get_public_soal_by_mapel(p_mapel_id UUID)
RETURNS TABLE (
  id                UUID,
  pertanyaan        TEXT,
  tipe              TEXT,
  tingkat_kesulitan TEXT,
  bab_id_text       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = psat, public
AS $$
  SELECT id, pertanyaan, tipe, tingkat_kesulitan, bab_id_text
  FROM psat.bank_soal
  WHERE mata_pelajaran_id = p_mapel_id
    AND status = 'approved'
  ORDER BY bab_id_text, tipe, tingkat_kesulitan, created_at
$$;

GRANT EXECUTE ON FUNCTION psat.get_public_soal_by_mapel(UUID) TO anon;

-- =============================================================================
-- Public: matrix blueprint per mapel (submitted matrices only)
-- =============================================================================

CREATE OR REPLACE FUNCTION psat.get_public_matrix_by_mapel(p_mapel_id UUID)
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
    AND mi.is_submitted = true
  ORDER BY mi.bab_id_text
$$;

GRANT EXECUTE ON FUNCTION psat.get_public_matrix_by_mapel(UUID) TO anon;
