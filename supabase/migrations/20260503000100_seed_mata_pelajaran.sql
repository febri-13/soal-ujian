-- =============================================================================
-- Seed: Mata Pelajaran
-- =============================================================================
-- Gabungan dari dua sumber:
--   - UUID & nama dasar: data terbaru lms-new
--   - Kode (kalau cocok dengan nama): data sebelumnya
--   - Mapel Cambridge: tetap di-keep meskipun tidak ada di data terbaru
-- Idempotent: pakai ON CONFLICT (id) DO UPDATE.
-- =============================================================================

BEGIN;

INSERT INTO psat.mata_pelajaran (id, nama, kode, deskripsi, created_at) VALUES
  -- Mapel utama (UUID & nama dari data terbaru, kode di-match dari data lama)
  ('069f658f-26d7-47b9-9697-ad152a0454e2', 'IFE',               'IFE',   NULL, '2026-03-08 22:57:52.793264+00'),
  ('0cac86d2-3018-4709-ad32-25862a0bffd6', 'Tryout',            NULL,    NULL, '2026-04-22 08:39:49+00'),
  ('5333becf-5fae-4765-be73-b9dcf8d650bf', 'Mathematics',       'MTK',   NULL, '2026-03-08 22:57:52.793264+00'),
  ('754edf07-e611-415e-a357-2b629f158d27', 'Indonesia',         'BIN',   NULL, '2026-03-08 22:57:52.793264+00'),
  ('7820b87c-ed56-43d5-aaaf-48db75c7306c', 'Science',           'IPA',   NULL, '2026-03-08 22:57:52.793264+00'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ICT Progul',        'ICT-P', NULL, '2026-02-28 23:13:29.132982+00'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Qur''an',           'QUR',   NULL, '2026-02-28 23:13:29.132982+00'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'English',           'EN',    NULL, '2026-02-28 23:13:29.132982+00'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Social',            'IPS',   NULL, '2026-02-28 23:13:29.132982+00'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'ICT Non Progul',    'ICT-N', NULL, '2026-03-02 04:04:10.159026+00'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Civics',            'PKn',   NULL, '2026-03-03 16:18:27.841459+00'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Sport',             'PJOK',  NULL, '2026-03-03 16:18:50.42008+00'),
  ('d2669612-cc1b-4716-9f42-e33c895816a6', 'TKA Math',          NULL,    NULL, '2026-03-08 22:57:52.793264+00'),
  ('e71db961-d5ed-4a8d-aa35-8f224bf8bf60', 'TKA IND',           NULL,    NULL, '2026-03-08 22:57:52.793264+00'),

  -- Mapel Cambridge (di-keep dari data lama, tidak boleh dihapus)
  ('3b7e5a8e-59ad-423b-b9e8-fb7228d6a63e', 'IPA Cambridge',     'IPA-C', NULL, '2026-05-03 01:44:59.742163+00'),
  ('5df216a6-e06e-40b5-af83-297464886c38', 'Math Cambridge',    'MTK-C', NULL, '2026-05-03 01:44:59.742163+00'),
  ('f404ce43-1c3b-493b-af82-d1e1bab019b4', 'English Cambridge', 'BIG',   NULL, '2026-05-03 01:44:59.742163+00')
ON CONFLICT (id) DO UPDATE SET
  nama      = EXCLUDED.nama,
  kode      = EXCLUDED.kode,
  deskripsi = EXCLUDED.deskripsi;

COMMIT;
