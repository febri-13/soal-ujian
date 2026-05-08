-- Tabel konfigurasi bobot soal per mata pelajaran
CREATE TABLE IF NOT EXISTS psat.bobot_config (
  mapel_id   UUID NOT NULL REFERENCES psat.mata_pelajaran(id) ON DELETE CASCADE,
  tipe       TEXT NOT NULL,
  kesulitan  TEXT NOT NULL,
  bobot      NUMERIC(4,2) NOT NULL,
  PRIMARY KEY (mapel_id, tipe, kesulitan)
);

ALTER TABLE psat.bobot_config ENABLE ROW LEVEL SECURITY;

-- Admin bisa baca dan tulis
CREATE POLICY "bobot_config_admin" ON psat.bobot_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM psat.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM psat.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Semua user terautentikasi bisa baca (guru perlu load bobot mapelnya)
CREATE POLICY "bobot_config_read" ON psat.bobot_config
  FOR SELECT TO authenticated
  USING (true);
