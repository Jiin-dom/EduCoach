# EduCoach Abuse-Resistant Rate Limiting Plan

## Summary
Use a layered, risk-first design:
- Hard, server-enforced limits for the costly or bypass-prone paths: upload creation, document processing, quiz generation, and AI tutor.
- Native-provider protection plus escalating CAPTCHA for public auth, without moving login/signup behind a custom proxy.
- Lighter client throttles and field caps for normal form components so routine study actions stay fast.

## Key Changes
### 1. Add one shared server-side quota system
- Add a Supabase migration with:
  - `public.rate_limit_counters(scope text, subject_key text, window_start timestamptz, count int, updated_at timestamptz, primary key(scope, subject_key, window_start))`
  - `public.rate_limit_denials(id uuid, scope text, subject_key text, user_id uuid null, resource_id uuid null, retry_after_seconds int, created_at timestamptz default now())`
  - RPC `public.consume_rate_limit(p_scope text, p_subject_key text, p_limit int, p_window_seconds int, p_cost int default 1)` returning `allowed`, `remaining`, `retry_after_seconds`, `window_started_at`
- Add `supabase/functions/_shared/rate-limit.ts` to wrap the RPC and standardize deny responses.
- Standardize limited responses across edge functions to `HTTP 429` with `{ success: false, error, errorCode: "RATE_LIMITED", scope, retryAfterSeconds }`.

### 2. Harden uploads, not just processing
- Replace direct browser storage upload in `src/lib/storage.ts` with:
  - `create-upload-ticket` edge function: validates auth, MIME, size, filename, consumes upload quota, creates a `documents` row in `uploading` state, returns `{ documentId, filePath, signedUploadUrl, expiresAt }`
  - `complete-upload` edge function: verifies object exists, flips document to `pending`, then starts processing
- Update storage policies so authenticated users can no longer upload directly with the client token; uploads must go through signed upload URLs.
- Expand `documents.status` to include `uploading`.

### 3. Enforce hard limits on expensive edge functions
- `process-document`:
  - Per user: `6/hour`
  - Per document: `1/10 minutes`
  - Reject when the same user already has `3` documents in `uploading|processing`
  - Perform limit check before downloading from storage or calling NLP/Gemini
- `generate-quiz`:
  - Per user: `10/hour`
  - Per document: `1/5 minutes`
  - Keep the existing “reuse generating quiz” behavior after the quota check
  - Validate `questionCount` to `1..20`; dedupe and cap `questionTypes` to `4`
- `ai-tutor`:
  - Burst limit: `4/30 seconds` per user
  - Sustained limit: `30/10 minutes` per user
  - One in-flight send per conversation
  - Validate `message.trim().length` to `1..2000`
  - Perform limit checks before embeddings, vector search, or Gemini calls

### 4. Protect auth without proxying Supabase Auth
- Keep `signInWithPassword` and `signUp` direct in `src/contexts/AuthContext.tsx`.
- Enable Supabase Auth native protections and email/signup rate limits.
- Add escalating CAPTCHA to login and register:
  - Show CAPTCHA after `3` failed login attempts in `10 minutes` for the same email in the same browser
  - Show CAPTCHA after `2` signup failures in `15 minutes`
  - Reset counters on success
- Add client cooldowns:
  - Login: `30s` lockout after threshold breach
  - Signup: `60s` lockout after threshold breach
- Normalize auth error UX so repeated failures do not expose different backend messages.

### 5. Add lightweight client throttles for fields and components
- Add `src/lib/rateLimitClient.ts` plus a shared `useRateLimitedAction` hook for countdowns and disabled states.
- Apply it to:
  - AI tutor send button and Enter-submit in `src/components/shared/AiTutorChat.tsx`
  - All quiz generation triggers in dashboard/files/dialog/retry flows
  - All document reprocess/refine buttons
  - Upload submit button in `FileUploadDialog`
- Tighten field-level validation:
  - Document title max `120` chars
  - Profile/display name max `80` chars
  - Study notes max `20,000` chars
  - Chat input max `2,000` chars
- Low-cost writes stay soft-limited:
  - Notes autosave debounce from `1000ms` to `2500ms`
  - Skip autosave when content is unchanged after trim normalization
  - Profile/profiling remains single-submit only, no hard server quota
- Keep quiz answering, flashcard review, and mastery logging free of hard quotas; only keep double-submit prevention so legitimate fast studying is not blocked.

## Public API / Interface Changes
- `Document.status` gains `'uploading'`.
- New edge functions:
  - `create-upload-ticket`
  - `complete-upload`
- Existing edge function error contract adds `errorCode`, `scope`, and `retryAfterSeconds` on `429`.
- New shared client error type: `RateLimitError`.
- New shared server helper contract for policy checks in Supabase edge functions.

## Test Plan
- SQL/RPC:
  - Concurrent `consume_rate_limit` calls stop exactly at the configured limit and return correct `retryAfterSeconds`
- Upload flow:
  - Direct authenticated upload to the bucket is rejected
  - Signed upload URL works once, then expires
  - Over-limit upload attempts return `429` before storage or DB-heavy work
- Edge functions:
  - `process-document`, `generate-quiz`, and `ai-tutor` do not call NLP/Gemini when limited
  - Per-document cooldowns block rapid retries and return the shared payload shape
- Auth:
  - Repeated failed login/signup attempts trigger CAPTCHA and local cooldown
  - Successful auth clears local counters
- Client UX:
  - Disabled buttons show countdowns and recover automatically after cooldown
  - Notes autosave no longer writes on every keystroke burst
  - Existing legitimate rapid study actions still work: quiz attempt submit once, flashcard review repeatedly

## Assumptions and Defaults
- V1 uses Postgres-backed fixed-window counters inside Supabase; no Redis or external WAF is introduced.
- Auth remains direct to Supabase Auth; no custom auth proxy is added in this phase.
- Server-owned hard limits are keyed by `user_id` and resource ID; IP-based protection is delegated to Supabase/Auth/CAPTCHA.
- Denials are persisted only for blocked attempts, not every allowed request.
- Quota values above are the initial defaults and should live in code for v1, not in an admin-managed policy table.
