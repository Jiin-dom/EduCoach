-- =====================================================
-- EDUCOACH Database Migration
-- Phase 7.1: Subscription Trial Window (Student Upsell)
-- =====================================================

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'subscriptions_trial_window_check'
          AND conrelid = 'public.subscriptions'::regclass
    ) THEN
        ALTER TABLE public.subscriptions
            ADD CONSTRAINT subscriptions_trial_window_check
            CHECK (
                trial_started_at IS NULL
                OR trial_ends_at IS NULL
                OR trial_ends_at >= trial_started_at
            );
    END IF;
END $$;

-- New signups receive a full 14-day premium trial window metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    created_at_ts TIMESTAMPTZ := COALESCE(NEW.created_at, NOW());
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
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
