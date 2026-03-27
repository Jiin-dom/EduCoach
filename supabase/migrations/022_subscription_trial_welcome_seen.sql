-- =====================================================
-- EDUCOACH Database Migration
-- Phase 7.2: Cross-Device Trial Welcome Modal State
-- =====================================================

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS trial_welcome_seen_at TIMESTAMPTZ;
