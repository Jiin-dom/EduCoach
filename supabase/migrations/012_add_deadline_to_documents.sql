-- =====================================================
-- EDUCOACH Database Migration
-- Feature: Optional Deadline for Documents
-- =====================================================

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
