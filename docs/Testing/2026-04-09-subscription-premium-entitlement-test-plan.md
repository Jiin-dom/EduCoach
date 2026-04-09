# Subscription, Trial & Premium Entitlement Test Plan

- Date: 2026-04-09
- Feature area: Student subscription, trial, premium gating, checkout mock flow
- Dependency map: `educoach/docs/info/dependency-maps/subscription-premium-entitlement-dependency-map.md`
- Current routes: `/subscription`, `/subscription/checkout`

## Cross-checked scope

This plan is based on:

- `src/components/subscription/SubscriptionContent.tsx`
- `src/components/subscription/SubscriptionCheckoutContent.tsx`
- `src/hooks/useStudentSubscription.ts`
- `src/lib/subscription.ts`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/layout/DashboardHeader.tsx`
- `src/components/dashboard/DashboardContent.tsx`

## Core scenarios

### 1. View subscription page

- Open `/subscription` as a profiled student.
- Expected:
  - current plan/trial information appears
  - upgrade CTA is visible when applicable

### 2. Mock checkout flow

- Open `/subscription/checkout`.
- Complete the mock upgrade flow.
- Expected:
  - premium subscription state updates
  - user is returned to the correct post-checkout experience

### 3. Premium guard on analytics

- As a non-premium student, try `/analytics`.
- Expected:
  - premium route guard blocks access to the advanced analytics workspace
  - user is redirected toward upgrade flow or denied cleanly

### 4. Premium access after upgrade

- After upgrading, open `/analytics`.
- Expected:
  - advanced analytics page loads
  - premium gating no longer blocks access

### 5. Header/dashboard entitlement messaging

- Compare header and dashboard before and after premium entitlement.
- Expected:
  - CTA and trial messaging reflect current subscription state
  - premium-aware messaging updates correctly

### 6. Dashboard progress insight CTA routing

- Compare the dashboard `Progress Insights` CTA before and after premium entitlement.
- Expected:
  - free users are sent to `/subscription`
  - premium or active-trial users are sent to `/analytics`

### 7. Dashboard lightweight analytics remain available on free

- As a non-premium student, open `/dashboard`.
- Expected:
  - progress chart preview is still visible
  - topic mastery summary is still visible
  - only the advanced analytics workspace remains gated

## Edge cases

- expired trial
- active premium but stale profile cache on first page load
- direct navigation to `/subscription/checkout` without a valid upgrade context
- downgrade or cancelled premium state reflected from backend
- active trial should route dashboard CTA to `/analytics`
- stale entitlement after upgrade should not require a hard refresh for dashboard CTA or analytics access

## Validation points

- subscription state is consumed consistently by route guards, header, and dashboard
- lightweight dashboard insights remain available even when full analytics is gated
- premium entitlement changes do not require a hard refresh

## Pass criteria

- Student subscription state is readable, upgrade flow works, lightweight dashboard insights stay visible, and premium guards enforce advanced analytics access correctly.
