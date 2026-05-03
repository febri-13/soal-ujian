import { pgTable, text, uuid, boolean, timestamp, jsonb, pgEnum, integer, serial } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['guru', 'siswa', 'admin', 'admin_keuangan', 'validator'])
export const docStatusEnum = pgEnum('doc_status', ['belum_upload', 'under_review', 'approved', 'needs_revision'])

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  nama: text('nama'),
  username: text('username'),
  avatarUrl: text('avatar_url'),
  nis: text('nis'),
  kelas: text('kelas'),
  role: userRoleEnum().default('guru'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const mataPelajaran = pgTable('mata_pelajaran', {
  id: uuid('id').defaultRandom().primaryKey(),
  nama: text('nama').notNull(),
  kode: text('kode'),
  deskripsi: text('deskripsi'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const babPelajaran = pgTable('bab_pelajaran', {
  id: uuid('id').defaultRandom().primaryKey(),
  mataPelajaranId: uuid('mata_pelajaran_id').references(() => mataPelajaran.id),
  namaBab: text('nama_bab').notNull(),
  urutan: integer('urutan'),
  deskripsi: text('deskripsi'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const bankSoal = pgTable('bank_soal', {
  id: uuid('id').defaultRandom().primaryKey(),
  pertanyaan: text('pertanyaan').notNull(),
  tipe: text('tipe').notNull(),
  mataPelajaranId: uuid('mata_pelajaran_id').references(() => mataPelajaran.id),
  guruId: uuid('guru_id').references(() => profiles.id),
  babId: uuid('bab_id').references(() => babPelajaran.id),
  level: text('level'),
  bobot: integer('bobot').default(1),
  tingkatKesulitan: text('tingkat_kesulitan').default('sedang'),
  tags: text('tags').array(),
  gambarUrl: text('gambar_url'),
  pilihan: jsonb('pilihan'),
  jawabanBenar: integer('jawaban_benar'),
  status: text('status').default('draft'),
  revisionNotes: text('revision_notes'),
  items: jsonb('items'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const psatGuruData = pgTable('psat_guru_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => profiles.id).notNull(),
  whatsapp: text('whatsapp'),
  noRekening: text('no_rekening'),
  bank: text('bank'),
  unitSekolah: text('unit_sekolah'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const psatPatokanSoal = pgTable('psat_patokan_soal', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => profiles.id).notNull(),
  mapelId: uuid('mapel_id').references(() => mataPelajaran.id),
  tipe: text('tipe').notNull(),
  tingkatKesulitan: text('tingkat_kesulitan').notNull(),
  keluar: text('keluar').notNull(),
  bank: text('bank').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const psatMatrixInput = pgTable('psat_matrix_input', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => profiles.id).notNull(),
  babId: uuid('bab_id').references(() => babPelajaran.id),
  data: jsonb('data').notNull(),
  isSubmitted: boolean('is_submitted').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const psatDokumenStatus = pgTable('psat_dokumen_status', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => profiles.id).notNull(),
  tipe: text('tipe').notNull(),
  fileUrl: text('file_url'),
  status: docStatusEnum().default('belum_upload'),
  versi: integer('versi').default(1),
  catatan: text('catatan'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type MataPelajaran = typeof mataPelajaran.$inferSelect
export type BabPelajaran = typeof babPelajaran.$inferSelect
export type BankSoal = typeof bankSoal.$inferSelect
export type PsatGuruData = typeof psatGuruData.$inferSelect
export type PsatPatokanSoal = typeof psatPatokanSoal.$inferSelect
export type PsatMatrixInput = typeof psatMatrixInput.$inferSelect
export type PsatDokumenStatus = typeof psatDokumenStatus.$inferSelect