-- =====================================================
-- EDUCOACH Database Migration
-- 029: Add first_name / last_name to user_profiles
-- Addresses professor feedback on database normalization.
-- =====================================================

-- 1. Add the new columns
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Backfill from existing display_name
--    "Jane Doe"  -> first_name='Jane', last_name='Doe'
--    "Prince"    -> first_name='Prince', last_name=NULL
--    NULL         -> both remain NULL
UPDATE public.user_profiles
SET
  first_name = split_part(display_name, ' ', 1),
  last_name  = NULLIF(
    trim(substring(display_name from position(' ' in display_name))),
    ''
  )
WHERE display_name IS NOT NULL
  AND first_name IS NULL;

-- 3. Extend handle_new_user() to read signup metadata.
--    CRITICAL: This replaces the version from migration 021 which also
--    creates the subscription row. Both behaviors are preserved here.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    created_at_ts TIMESTAMPTZ := COALESCE(NEW.created_at, NOW());
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'display_name'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    amount_php,
    currency,
    started_at,
    trial_started_at,
    trial_ends_at
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    0,
    'PHP',
    created_at_ts,
    created_at_ts,
    created_at_ts + INTERVAL '14 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE
-- Columns: first_name, last_name added to user_profiles
-- Trigger: handle_new_user reads raw_user_meta_data
-- =====================================================
