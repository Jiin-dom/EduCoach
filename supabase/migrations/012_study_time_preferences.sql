-- =====================================================
-- EDUCOACH Database Migration
-- Phase 6: Study Time Preferences
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- Extend user_profiles with preferred/available study windows
-- and the days of the week the user is available.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_study_time_start TIME;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_study_time_end TIME;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS available_study_days TEXT[];

-- If this migration was previously applied with "available_study_time_*",
-- drop them to match the new single time-window onboarding UX.
ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS available_study_time_start;

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS available_study_time_end;

-- MIGRATION COMPLETE!

