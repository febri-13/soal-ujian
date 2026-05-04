ALTER TABLE psat.bank_soal
  ADD COLUMN IF NOT EXISTS pilihan_gambar TEXT[],
  ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;
