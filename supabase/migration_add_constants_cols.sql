-- Migration: add missing columns to financial_constants
-- Run this in Supabase SQL Editor if the table was created from the old schema

ALTER TABLE financial_constants
  ADD COLUMN IF NOT EXISTS income_per_student_caharon NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_per_student_caharon NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ministry_grant_per_student NUMERIC DEFAULT 360;

-- Create storage bucket for school documents (run once)
-- This can also be done via the Supabase Dashboard → Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-documents', 'school-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own school folder
CREATE POLICY IF NOT EXISTS "school_documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'school-documents');

CREATE POLICY IF NOT EXISTS "school_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'school-documents');
