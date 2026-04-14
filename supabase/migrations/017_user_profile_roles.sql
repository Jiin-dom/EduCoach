-- =====================================================
-- EDUCOACH Database Migration
-- Add role-based access controls for user profiles
-- =====================================================

-- 1) Add role column (student/admin) with safe defaults
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE public.user_profiles
SET role = 'student'
WHERE role IS NULL;

ALTER TABLE public.user_profiles
  ALTER COLUMN role SET DEFAULT 'student';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_role_check'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_role_check
      CHECK (role IN ('student', 'admin'));
  END IF;
END;
$$;

ALTER TABLE public.user_profiles
  ALTER COLUMN role SET NOT NULL;

-- 2) Guard role assignment changes from client-side self-promotion.
--    Only postgres/service_role can set or change admin role.
CREATE OR REPLACE FUNCTION public.guard_user_profile_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NULL THEN
      NEW.role := 'student';
    END IF;

    IF NEW.role <> 'student' AND current_user NOT IN ('postgres', 'service_role') THEN
      RAISE EXCEPTION 'Only service role can assign elevated roles';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Only service role can change roles';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profile_role_changes ON public.user_profiles;
CREATE TRIGGER guard_user_profile_role_changes
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_role_changes();
