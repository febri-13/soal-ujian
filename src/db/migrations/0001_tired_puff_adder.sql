CREATE TABLE "bab_pelajaran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mata_pelajaran_id" uuid,
	"nama_bab" text NOT NULL,
	"urutan" integer,
	"deskripsi" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_soal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pertanyaan" text NOT NULL,
	"tipe" text NOT NULL,
	"mata_pelajaran_id" uuid,
	"guru_id" uuid,
	"bab_id" uuid,
	"level" text,
	"bobot" integer DEFAULT 1,
	"tingkat_kesulitan" text DEFAULT 'sedang',
	"tags" text[],
	"gambar_url" text,
	"pilihan" jsonb,
	"jawaban_benar" integer,
	"items" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mata_pelajaran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"kode" text,
	"deskripsi" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psat_matrix_input" DROP CONSTRAINT "psat_matrix_input_bab_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "psat_patokan_soal" DROP CONSTRAINT "psat_patokan_soal_mapel_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "bab_pelajaran" ADD CONSTRAINT "bab_pelajaran_mata_pelajaran_id_mata_pelajaran_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "public"."mata_pelajaran"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_soal" ADD CONSTRAINT "bank_soal_mata_pelajaran_id_mata_pelajaran_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "public"."mata_pelajaran"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_soal" ADD CONSTRAINT "bank_soal_guru_id_profiles_id_fk" FOREIGN KEY ("guru_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_soal" ADD CONSTRAINT "bank_soal_bab_id_bab_pelajaran_id_fk" FOREIGN KEY ("bab_id") REFERENCES "public"."bab_pelajaran"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psat_matrix_input" ADD CONSTRAINT "psat_matrix_input_bab_id_bab_pelajaran_id_fk" FOREIGN KEY ("bab_id") REFERENCES "public"."bab_pelajaran"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psat_patokan_soal" ADD CONSTRAINT "psat_patokan_soal_mapel_id_mata_pelajaran_id_fk" FOREIGN KEY ("mapel_id") REFERENCES "public"."mata_pelajaran"("id") ON DELETE no action ON UPDATE no action;