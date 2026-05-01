-- =====================================================
-- EDUCOACH Database Migration
-- Public helper for email existence checks
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE lower(up.email) = lower(p_email)
  );
$$;

REVOKE ALL ON FUNCTION public.check_email_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO service_role;
