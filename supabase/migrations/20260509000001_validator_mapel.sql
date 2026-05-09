CREATE TABLE psat.psat_validator_mapel (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  validator_id UUID NOT NULL REFERENCES psat.profiles(id) ON DELETE CASCADE,
  mapel_id     UUID NOT NULL REFERENCES psat.mata_pelajaran(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (validator_id, mapel_id)
);

ALTER TABLE psat.psat_validator_mapel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON psat.psat_validator_mapel
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM psat.profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM psat.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "validator_read_own" ON psat.psat_validator_mapel
  FOR SELECT TO authenticated
  USING (validator_id = auth.uid());
