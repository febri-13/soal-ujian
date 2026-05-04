-- =============================================================================
-- Public RPC: get_public_mapel_progress
-- Returns per-subject question upload progress for the public homepage.
-- SECURITY DEFINER so anon role can call it without bypassing table-level RLS
-- directly (the function owner's privileges are used internally).
-- =============================================================================

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
  needs_revision  BIGINT
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
    COUNT(bs.id) FILTER (WHERE bs.status = 'needs_revision')  AS needs_revision
  FROM psat.mata_pelajaran mp
  LEFT JOIN psat.bank_soal bs ON bs.mata_pelajaran_id = mp.id
  GROUP BY mp.id, mp.nama, mp.kode
  ORDER BY mp.nama ASC
$$;

GRANT EXECUTE ON FUNCTION psat.get_public_mapel_progress() TO anon;
