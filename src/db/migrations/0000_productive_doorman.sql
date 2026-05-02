CREATE TYPE "public"."doc_status" AS ENUM('belum_upload', 'under_review', 'approved', 'needs_revision');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('guru', 'siswa', 'admin', 'admin_keuangan');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nama" text,
	"username" text,
	"avatar_url" text,
	"nis" text,
	"kelas" text,
	"role" "user_role" DEFAULT 'guru',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psat_dokumen_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"tipe" text NOT NULL,
	"file_url" text,
	"status" "doc_status" DEFAULT 'belum_upload',
	"versi" integer DEFAULT 1,
	"catatan" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psat_guru_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"whatsapp" text,
	"no_rekening" text,
	"bank" text,
	"unit_sekolah" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psat_matrix_input" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"bab_id" uuid,
	"data" jsonb NOT NULL,
	"is_submitted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psat_patokan_soal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mapel_id" uuid,
	"tipe" text NOT NULL,
	"tingkat_kesulitan" text NOT NULL,
	"keluar" integer DEFAULT 0,
	"bank" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psat_dokumen_status" ADD CONSTRAINT "psat_dokumen_status_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psat_guru_data" ADD CONSTRAINT "psat_guru_data_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psat_matrix_input" ADD CONSTRAINT "psat_matrix_input_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psat_matrix_input" ADD CONSTRAINT "psat_matrix_input_bab_id_profiles_id_fk" FOREIGN KEY ("bab_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psat_patokan_soal" ADD CONSTRAINT "psat_patokan_soal_mapel_id_profiles_id_fk" FOREIGN KEY ("mapel_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;