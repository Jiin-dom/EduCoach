# EduCoach Dependency Maps

Last cross-checked: 2026-04-02

This folder contains current-state dependency maps for the `educoach` web app. Each map was built by checking the historical docs in `educoach/docs/completed` and `educoach/docs/info` against the code that currently exists in `educoach/src`.

Use these maps when you need to answer:
- where a feature starts in routing
- which components own the UI
- which hooks/libs/services carry the logic
- which Supabase tables, RPCs, storage buckets, or Edge Functions the web app depends on

## Coverage Matrix

| Product area | Dependency map | Historical docs cross-checked | Current route/page entry points |
|---|---|---|---|
| Phase 1 foundation/authentication | `phase-1-foundation-authentication-dependency-map.md` | `phase-1-foundation-authentication-and-database.md`, `admin-bootstrap.md` | `/login`, `/register`, protected routes in `App.tsx` |
| Social OAuth + auth UI redesign | `social-oauth-auth-ui-dependency-map.md` | `2026-03-19-social-oauth-sign-in.md` | `/login`, `/register` |
| Phase 2 profiling/core data + assign deadline | `phase-2-profiling-documents-dependency-map.md` | `phase-2-user-profiling-and-core-data.md`, `feature-assign-deadline.md` | `/profiling`, `/dashboard`, `/files` |
| Phase 3 document processing + study materials + phase 3.x pipeline upgrades | `phase-3-document-processing-study-materials-dependency-map.md` | `phase-3-document-processing-pipeline.md`, `phase-3-concept-extraction-improvements.md`, `phase-3.5-content-quality-upgrade.md`, `phase-3.6-slide-aware-pipeline.md`, `phase-3.7-pipeline-quality-phase2.md`, `phase-3.8-pipeline-enrichment.md`, `phase-3.9-ux-resilience-upgrade.md`, `embedding-model-migration.md` | `/files/:id` |
| Phase 4 quiz system + view results + quiz allocation fixes | `phase-4-quiz-system-dependency-map.md` | `phase-4-quiz-generation-and-attempts.md`, `phase-4.x-quiz-ui-and-types(3-16-2026).md`, `phase-4.x-quiz-generation-improvements.md`, `feature-view-quiz-results.md`, `2026-03-31-quiz-generation-supplement-import-fix.md`, `quiz-question-type-allocation-behavior.md` | `/quizzes`, `/quizzes/:id`, quiz dialogs from `/files` and `/dashboard` |
| Phase 5 learning intelligence + analytics + advanced learning intelligence | `phase-5-learning-intelligence-analytics-dependency-map.md` | `phase-5-learning-intelligence-and-analytics.md`, `phase-5.x-learning-intelligence-improvements.md`, `phase-6.2-advanced-learning-intelligence.md`, `learning_path_explained.md`, `feature-assign-deadline.md` | `/learning-path`, `/analytics`, dashboard cards |
| Phase 6 AI tutor + remediation | `phase-6-ai-tutor-rag-dependency-map.md` | `phase-6-ai-tutor-chat-rag.md`, `2026-03-26-ai-tutor-remediation-report.md`, `embedding-model-migration.md` | shared chat mounted from `/dashboard` and `/files/:id` |
| Admin user/subscription management | `admin-user-management-dependency-map.md` | `2026-03-27-admin-user-management-supabase.md`, `admin-bootstrap.md` | `/admin/users`, `/admin/subscriptions` |
| Subscription, trial, premium entitlement | `subscription-premium-entitlement-dependency-map.md` | `2026-03-27-subscription-system-free-premium.md`, `2026-03-27-student-subscription-page-trial-mock-checkout.md` | `/subscription`, `/subscription/checkout`, guards/CTAs across the app |
| In-app notifications | `in-app-notifications-dependency-map.md` | `2026-03-28-in-app-notifications-web-first.md` | bell inbox in `DashboardHeader.tsx` |
| Profile/account settings + change password | `profile-account-settings-dependency-map.md` | `feature-change-password.md` | `/profile` |

## Reading Rule

Historical docs explain why a feature was built. The dependency maps in this folder explain how the current web app is wired today. If the old docs and the live source disagree, prefer the dependency map and then verify the exact file in `educoach/src`.
