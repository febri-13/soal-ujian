-- Tambah kolom unit_sekolah ke RPC get_public_guru_progress
-- Diambil dari psat_guru_data.unit_sekolah

DROP FUNCTION IF EXISTS psat.get_public_guru_progress();

CREATE OR REPLACE FUNCTION psat.get_public_guru_progress()
RETURNS TABLE (
  profile_id          UUID,
  guru_nama           TEXT,
  guru_kelas          TEXT,
  guru_unit_sekolah   TEXT,
  mapel_id            UUID,
  mapel_nama          TEXT,
  mapel_kode          TEXT,
  total               BIGINT,
  approved            BIGINT,
  submitted           BIGINT,
  draft               BIGINT,
  needs_revision      BIGINT,
  patokan_bank_total  BIGINT,
  glossary_url        TEXT,
  kisi_kisi_url       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = psat, public
AS $$
  SELECT
    p.id                                                          AS profile_id,
    p.nama                                                        AS guru_nama,
    p.kelas                                                       AS guru_kelas,
    gd.unit_sekolah                                               AS guru_unit_sekolah,
    mp.id                                                         AS mapel_id,
    mp.nama                                                       AS mapel_nama,
    mp.kode                                                       AS mapel_kode,
    COUNT(bs.id)                                                  AS total,
    COUNT(bs.id) FILTER (WHERE bs.status = 'approved')           AS approved,
    COUNT(bs.id) FILTER (WHERE bs.status = 'submitted')          AS submitted,
    COUNT(bs.id) FILTER (WHERE bs.status = 'draft')              AS draft,
    COUNT(bs.id) FILTER (WHERE bs.status = 'needs_revision')     AS needs_revision,
    COALESCE((
      SELECT SUM(v::integer)
      FROM psat.psat_patokan_soal ps,
           unnest(string_to_array(ps.bank, ',')) v
      WHERE ps.mapel_id = mp.id
        AND v <> ''
        AND v ~ '^[0-9]+$'
    ), 0)                                                         AS patokan_bank_total,
    (
      SELECT ds.file_url
      FROM psat.psat_dokumen_status ds
      WHERE ds.profile_id = p.id AND ds.tipe = 'glossary'
      LIMIT 1
    )                                                             AS glossary_url,
    (
      SELECT ds.file_url
      FROM psat.psat_dokumen_status ds
      WHERE ds.profile_id = p.id AND ds.tipe = 'kisi_kisi'
      LIMIT 1
    )                                                             AS kisi_kisi_url
  FROM psat.psat_guru_data gd
  JOIN psat.profiles p ON p.id = gd.profile_id
  JOIN psat.mata_pelajaran mp ON mp.id = gd.mapel_id
  LEFT JOIN psat.bank_soal bs ON bs.guru_id = p.id
  GROUP BY p.id, p.nama, p.kelas, gd.unit_sekolah, mp.id, mp.nama, mp.kode
  ORDER BY mp.nama ASC, p.kelas ASC, p.nama ASC
$$;

GRANT EXECUTE ON FUNCTION psat.get_public_guru_progress() TO anon;
