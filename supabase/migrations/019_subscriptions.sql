-- =====================================================
-- EDUCOACH Database Migration
-- Phase 7: Subscription State + Admin Management
-- =====================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'suspended')),
    amount_php INTEGER NOT NULL DEFAULT 0 CHECK (amount_php >= 0),
    currency TEXT NOT NULL DEFAULT 'PHP',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_billing_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    renewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_status ON public.subscriptions(plan, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_started_at ON public.subscriptions(started_at DESC);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
    ON public.subscriptions FOR SELECT
    USING (
        auth.role() = 'service_role'
        OR public.is_admin_user()
    );

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
    ON public.subscriptions FOR ALL
    USING (
        auth.role() = 'service_role'
        OR public.is_admin_user()
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_admin_user()
    );

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill existing users with default free subscriptions.
INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    amount_php,
    currency,
    started_at
)
SELECT
    up.id,
    'free',
    'active',
    0,
    'PHP',
    COALESCE(up.created_at, NOW())
FROM public.user_profiles up
ON CONFLICT (user_id) DO NOTHING;

-- Update signup trigger to include default subscription provisioning.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status, amount_php, currency, started_at)
  VALUES (NEW.id, 'free', 'active', 0, 'PHP', COALESCE(NEW.created_at, NOW()))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
