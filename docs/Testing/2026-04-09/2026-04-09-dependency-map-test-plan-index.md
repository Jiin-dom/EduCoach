# Dependency Map Test Plan Index

- Date: 2026-04-09
- App affected: educoach
- Scope: Test-plan pack generated from `educoach/docs/info/dependency-maps` after cross-checking routes, dependency maps, completed docs, and current source entry points.

## Test Plans

- [Phase 1 Foundation & Authentication Test Plan](./2026-04-09-phase-1-foundation-authentication-test-plan.md)
- [Social OAuth & Auth UI Test Plan](./2026-04-09-social-oauth-auth-ui-test-plan.md)
- [Phase 2 Profiling, Core Data & Document Library Test Plan](./2026-04-09-phase-2-profiling-documents-test-plan.md)
- [Phase 3 Document Processing & Study Materials Test Plan](./2026-04-09-phase-3-document-processing-study-materials-test-plan.md)
- [Phase 4 Quiz System Test Plan](./2026-04-09-phase-4-quiz-system-test-plan.md)
- [Phase 5 Learning Intelligence & Analytics Test Plan](./2026-04-09-phase-5-learning-intelligence-analytics-test-plan.md)
- [Phase 6 AI Tutor RAG Test Plan](./2026-04-09-phase-6-ai-tutor-rag-test-plan.md)
- [In-App Notifications Test Plan](./2026-04-09-in-app-notifications-test-plan.md)
- [Admin User Management Test Plan](./2026-04-09-admin-user-management-test-plan.md)
- [Subscription, Trial & Premium Entitlement Test Plan](./2026-04-09-subscription-premium-entitlement-test-plan.md)
- [Profile & Account Settings Test Plan](./2026-04-09-profile-account-settings-test-plan.md)
- [Learning Path Gap Fix Test Plan](./2026-04-09-learning-path-gap-fix-test-plan.md)

## Notes

- These test plans follow the current dependency maps, not older historical architecture assumptions.
- Where historical docs and the current app differed, the test plans were aligned to the dependency maps and the live `src` routing/component tree.
- Phase 5 and Subscription test plans include the hybrid analytics access model:
  - dashboard progress insights for all students
  - premium-only advanced analytics workspace on `/analytics`
