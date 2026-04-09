# EduCoach Feature Dependency Maps

**Date:** 2026-04-02

**App affected:** educoach

**Type of work:** documentation

## Summary of what was implemented

Created a dependency-map reference set for the `educoach` web app under `educoach/docs/info/dependency-maps`. The new documentation groups the existing completed/info docs into current product areas and maps each one to the live route, page, component, hook, service, and utility files that currently exist in `educoach/src`.

## Problem being solved

The repo already had strong historical writeups in `docs/completed` and `docs/info`, but those files describe implementation phases over time. They were not a fast way to answer “what files currently own this feature?” or “where does this route hand off to hooks, utilities, and Supabase?” The new dependency maps solve that by turning historical scope into current-state file ownership references.

## Scope of changes

- Added a new documentation folder: `educoach/docs/info/dependency-maps`
- Added an index/coverage matrix for major EduCoach product areas
- Added separate dependency-map Markdown files for:
  - foundation/authentication
  - social OAuth/auth UI
  - profiling/documents
  - document processing/study materials
  - quiz system
  - learning intelligence/analytics
  - AI tutor
  - admin user management
  - subscription/premium entitlement
  - in-app notifications
  - profile/account settings
- Added this completion document
- Added a saved plan file in `.agents/plans`

## Files/modules/screens/components/services affected

- `.agents/plans/2026-04-02-educoach-dependency-map-plan.md`
- `educoach/docs/info/dependency-maps/README.md`
- `educoach/docs/info/dependency-maps/phase-1-foundation-authentication-dependency-map.md`
- `educoach/docs/info/dependency-maps/social-oauth-auth-ui-dependency-map.md`
- `educoach/docs/info/dependency-maps/phase-2-profiling-documents-dependency-map.md`
- `educoach/docs/info/dependency-maps/phase-3-document-processing-study-materials-dependency-map.md`
- `educoach/docs/info/dependency-maps/phase-4-quiz-system-dependency-map.md`
- `educoach/docs/info/dependency-maps/phase-5-learning-intelligence-analytics-dependency-map.md`
- `educoach/docs/info/dependency-maps/phase-6-ai-tutor-rag-dependency-map.md`
- `educoach/docs/info/dependency-maps/admin-user-management-dependency-map.md`
- `educoach/docs/info/dependency-maps/subscription-premium-entitlement-dependency-map.md`
- `educoach/docs/info/dependency-maps/in-app-notifications-dependency-map.md`
- `educoach/docs/info/dependency-maps/profile-account-settings-dependency-map.md`
- `educoach/docs/completed/2026-04-02-educoach-feature-dependency-maps.md`

## Supabase impact

- **Schema changes:** none
- **Policy changes:** none
- **Auth changes:** none
- **Storage changes:** none
- **API/query changes:** none

The work only documents existing Supabase dependencies such as auth, documents, concepts, quizzes, mastery, chat, subscriptions, and notifications.

## User-facing behavior changes

No runtime behavior changed. This is a documentation-only update for developers and maintainers.

## Developer notes or architectural decisions

- The dependency maps prefer current code over historical phase wording when they disagree.
- Smaller feature docs were grouped into the current subsystem that now owns them. Example: `feature-view-quiz-results` is covered by the quiz-system map, and `feature-change-password` is covered by the profile/account settings map.
- Backend-heavy phase 3.x documents were mapped to their thin but still important web touchpoints instead of pretending every pipeline improvement changed the React component graph.

## Testing/verification performed

- Listed and reviewed `educoach/docs/completed` and `educoach/docs/info`
- Listed and reviewed the current `educoach/src` route, page, component, hook, service, lib, and type files
- Cross-checked route ownership in `src/App.tsx`
- Cross-checked shared bootstrapping in `src/main.tsx`
- Cross-checked feature wiring by reading current imports in major components and hooks
- Verified the new dependency-map folder structure exists

## Known limitations

- These maps are intentionally current-state summaries, not exhaustive import graphs for every transitive dependency.
- Backend paths outside the web app are included as touchpoints, but this documentation set is still centered on `educoach`.
- Future refactors will require refreshing the maps if routes, hooks, or ownership boundaries move.

## Follow-up tasks or recommended next steps

- Add a short maintenance note to the developer workflow so new feature work updates the relevant dependency map when ownership changes.
- Consider adding a web/mobile/shared coverage matrix if the same exercise is needed for `educoach-mobile`.
- If phase-level backend maps are needed later, create a separate dependency-map set rooted at `supabase/` and the NLP service instead of expanding these web-focused documents too far.
