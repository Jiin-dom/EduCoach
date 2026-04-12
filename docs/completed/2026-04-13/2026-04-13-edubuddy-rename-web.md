# AI Tutor → EduBuddy Rename (Web App)

## Date
2026-04-13

## App Affected
`educoach`

## Type of Work
UI

## Summary
Renamed all user-facing "AI Tutor" text to "EduBuddy" across the educoach web application, matching the rename already applied in the mobile app. This is a cosmetic/branding change only — no route names, file names, hook names, or internal identifiers were modified.

## Problem Being Solved
The AI chat assistant feature was branded as "AI Tutor" on the web app but had already been renamed to "EduBuddy" on the mobile app. This created inconsistency across platforms.

## Scope of Changes

### AiTutorChat.tsx (chat widget)
| Location | Before | After |
|----------|--------|-------|
| Header title | "EDUCOACH AI Tutor" | "EduBuddy" |
| History empty state | "Start chatting with the AI Tutor..." | "Start chatting with EduBuddy..." |
| Message role label | "AI Tutor • 12:34" | "EduBuddy • 12:34" |

### DashboardContent.tsx
| Location | Before | After |
|----------|--------|-------|
| Trial modal feature | "Unlimited AI Tutor" | "Unlimited EduBuddy" |
| Trial-ended banner | "...unlimited AI Tutor and full analytics" | "...unlimited EduBuddy and full analytics" |

### SubscriptionContent.tsx
| Location | Before | After |
|----------|--------|-------|
| Free plan feature | "5 AI Tutor messages per day" | "5 EduBuddy messages per day" |
| Premium feature | "Unlimited AI Tutor messages" | "Unlimited EduBuddy messages" |
| Trial-ended banner | "...unlock unlimited AI Tutor..." | "...unlock unlimited EduBuddy..." |
| Current plan description | "...unlock unlimited AI Tutor..." | "...unlock unlimited EduBuddy..." |

### SubscriptionCheckoutContent.tsx
| Location | Before | After |
|----------|--------|-------|
| Already-premium message | "...unlimited AI Tutor..." | "...unlimited EduBuddy..." |
| Plan review description | "Unlimited AI Tutor, full analytics..." | "Unlimited EduBuddy, full analytics..." |

### LandingPage.tsx
| Location | Before | After |
|----------|--------|-------|
| Feature card title | "AI Tutor Assistant" | "EduBuddy Assistant" |
| Feature card description | "...intelligent AI tutor..." | "...intelligent EduBuddy assistant..." |
| Benefits section | "...materials and AI tutor" | "...materials and EduBuddy" |

## Files/Modules/Screens/Components Affected
| File | Change |
|------|--------|
| `src/components/shared/AiTutorChat.tsx` | Header, history, message role labels |
| `src/components/dashboard/DashboardContent.tsx` | Trial feature title + expired banner |
| `src/components/subscription/SubscriptionContent.tsx` | Feature lists + banners + description |
| `src/components/subscription/SubscriptionCheckoutContent.tsx` | Checkout copy |
| `src/pages/LandingPage.tsx` | Feature card + benefits copy |

## Supabase Impact
- Schema changes: None
- Policy changes: None
- Auth changes: None
- Storage changes: None
- API/query changes: None

## User-Facing Behavior Changes
- All visible references to "AI Tutor" on the educoach web app now read "EduBuddy"
- The chat widget header now says "EduBuddy" instead of "EDUCOACH AI Tutor"
- Message timestamps show "EduBuddy" as the sender label

## Developer Notes
- Internal identifiers (routes, hooks, filenames, component names) were NOT renamed — only user-facing display text changed
- The `useAiTutor` hook, `AiTutorChat` component name, `AiTutorChatScreen` route, etc. all remain unchanged
- The `AI_TUTOR_FREE_DAILY_LIMIT` constant name was kept — it's internal to `lib/subscription.ts` and not user-facing
- The test file `subscription.test.ts` has a comment mentioning "AI tutor" — this was left as-is since it's test documentation

## Testing/Verification
- Visual inspection in the running web app (dev server).

## Known Limitations
- None.

## Follow-Up Tasks
- None.
