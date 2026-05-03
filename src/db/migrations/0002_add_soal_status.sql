-- Add status columns to bank_soal for validator flow
ALTER TABLE "bank_soal" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'draft';
ALTER TABLE "bank_soal" ADD COLUMN IF NOT EXISTS "revision_notes" TEXT;