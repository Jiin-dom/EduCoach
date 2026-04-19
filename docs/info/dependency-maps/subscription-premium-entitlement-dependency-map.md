# Subscription, Trial & Premium Entitlement Dependency Map

Last cross-checked: 2026-04-16

**Source docs checked**
- `educoach/docs/completed/2026-03-27-subscription-system-free-premium.md`
- `educoach/docs/completed/2026-03-27-student-subscription-page-trial-mock-checkout.md`

**Primary current entry points**
- `/subscription`
- `/subscription/checkout`
- premium guards and upgrade CTAs across the app

## Current Dependency Flow

```text
pages/SubscriptionPage.tsx
  -> components/subscription/SubscriptionContent.tsx
      -> hooks/useStudentSubscription.ts
      -> lib/subscription.ts

pages/SubscriptionCheckoutPage.tsx
  -> components/subscription/SubscriptionCheckoutContent.tsx
      -> hooks/useStudentSubscription.ts
      -> hooks/useMockSubscribePremium()

contexts/AuthContext.tsx
  -> hydrates subscription fields into profile state
  -> consumed by ProtectedRoute.tsx and DashboardHeader.tsx
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/components/subscription/SubscriptionContent.tsx` | Student-facing plan/trial/upgrade view | `useStudentSubscription`, `lib/subscription.ts` |
| `src/components/subscription/SubscriptionCheckoutContent.tsx` | Mock premium checkout UI | `useStudentSubscription`, `useMockSubscribePremium`, `PREMIUM_MONTHLY_PRICE_PHP` |
| `src/hooks/useStudentSubscription.ts` | Student subscription fetch/update bridge to edge function | `supabase`, `ensureFreshSession`, `useAuth` |
| `src/lib/subscription.ts` | Canonical plan/status normalization and entitlement helpers | consumed across auth/header/subscription guards |
| `src/contexts/AuthContext.tsx` | Loads subscription and trial fields into profile | used by `ProtectedRoute`, `DashboardHeader`, `DashboardContent` |
| `src/components/auth/ProtectedRoute.tsx` | Route-level premium gating for `/analytics` | `hasPremiumEntitlement()` |
| `src/components/layout/DashboardHeader.tsx` | Shows analytics upgrade CTA and subscription nav | `hasPremiumEntitlement()` |
| `src/components/dashboard/DashboardContent.tsx` | Trial welcome modal/banner behavior | `useMarkTrialWelcomeSeen` |
| `src/components/files/FileUploadDialog.tsx` | Document upload limit gate for free users (5 docs) | `canUploadMoreDocuments()`, `FREE_DOCUMENT_LIMIT` |
| `src/components/files/FilesContent.tsx` | Document count indicator and upgrade CTA for free users at limit | `canUploadMoreDocuments()`, `FREE_DOCUMENT_LIMIT`, `useAuth` |

## Supabase / Backend Touchpoints

- `public.subscriptions`
- `public.documents` — RLS INSERT policy enforces 5-document limit for free users (migration `030_free_user_document_limit.sql`)
- `supabase/functions/student-subscription`
- `supabase/functions/admin-user-management` for admin-side subscription control
- premium-aware behavior in `supabase/functions/ai-tutor`
- quiz priority metadata described in historical docs still originates from subscription state

## Notes

- The student subscription and admin subscription work now share the same backend concept but different frontend entry points.
- Premium entitlement is a cross-cutting dependency, not a single page feature; route guards, header navigation, dashboard messaging, AI tutor limits, and document upload limits all consume it.
- Free-tier document upload limit (5 documents) is enforced at the RLS level as a hard backstop and at the UI level for smooth UX. Deleting a document frees a slot.
