-- =====================================================
-- EDUCOACH Database Migration
-- Phase 12: Free-tier document upload limit (5 documents)
-- =====================================================
-- Free users may only have up to 5 documents.
-- Premium users (active plan OR active trial) are unlimited.
-- This replaces the existing INSERT policy with a
-- subscription-aware variant. SELECT/UPDATE/DELETE untouched.
-- =====================================================

-- Drop the original open INSERT policy
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;

-- New INSERT policy: owner check + subscription-aware limit
CREATE POLICY "Users can insert own documents"
    ON public.documents FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Premium with active status: unlimited
            EXISTS (
                SELECT 1 FROM public.subscriptions s
                WHERE s.user_id = auth.uid()
                  AND s.plan = 'premium'
                  AND s.status = 'active'
            )
            -- Active trial: unlimited
            OR EXISTS (
                SELECT 1 FROM public.subscriptions s
                WHERE s.user_id = auth.uid()
                  AND s.trial_ends_at > now()
            )
            -- Otherwise: free user must have fewer than 5 documents
            OR (
                SELECT count(*) FROM public.documents d
                WHERE d.user_id = auth.uid()
            ) < 5
        )
    );
