# EduCoach Project Gaps

Date: 2026-03-15
Status: Pending review
Basis: local code inspection, completed docs review, `npm test`, `npm run build`

## Purpose

This document records gaps found while checking the current status of EduCoach. These are not speculative product ideas; they are issues where implementation, documentation, verification, or environment state do not fully line up.

## Gap 1: Adaptive quiz generation is only partially implemented

### What was found

The quiz Edge Function was updated to send adaptive inputs to the NLP service:

- `focusConceptIds` support exists in `supabase/functions/generate-quiz/index.ts`
- `mastery_context` is added to the NLP payload
- per-chunk `max_questions` is also added dynamically

However, the Python NLP service schema in `nlp-service/main.py` does not define or consume those adaptive fields:

- `GenerateQuestionsInput` accepts `chunks`, `all_keyphrases`, `question_types`, `max_questions_per_chunk`, `max_total_questions`, `difficulty`, `concepts`, and `document_type`
- `ChunkInput` accepts `chunk_id`, `text`, `keyphrases`, and `important_sentences`
- there is no `mastery_context` field
- there is no per-chunk `max_questions` field on `ChunkInput`

### Impact

- The Edge Function is sending adaptive quiz metadata, but the primary question generator appears to ignore it.
- The current implementation may still support targeted review selection through `focusConceptIds` on the Edge Function side, but mastery-aware weighting inside the NLP generator is not actually wired through.
- The completed Phase 6.2 document currently overstates how complete the adaptive behavior is.

### Recommended next work

1. Add explicit `mastery_context` and per-chunk quota fields to the NLP request models.
2. Update `/generate-questions` logic to use mastery signals when choosing question density, difficulty, and concept coverage.
3. Add automated tests for adaptive payload handling at the Edge Function and NLP service boundary.
4. Re-verify the feature manually with two quizzes from the same document after different mastery states.

## Gap 2: Top-level project overview is outdated

### What was found

`EduCoach_Overview.md` still describes several major features as "coming soon", including:

- quizzes
- flashcards
- personalized learning path scheduling

But the `docs/completed` folder already records these areas as implemented in later phases, including:

- quiz generation and attempts
- learning intelligence and analytics
- AI tutor chat with RAG
- advanced learning intelligence / review flows

### Impact

- The top-level project description no longer matches the actual state of the codebase.
- New contributors can get the wrong impression about what is already built.
- This increases the chance of duplicated work or incorrect planning.

### Recommended next work

1. Rewrite `EduCoach_Overview.md` so it matches the implemented phases.
2. Separate "implemented now" from "next targets" clearly.
3. Link the overview to the key completed phase documents.

## Gap 3: Automated verification coverage is narrow

### What was found

The current automated test run passes, but it only covers one file:

- `src/lib/learningAlgorithms.test.ts`

This is good coverage for the pure learning-algorithm math, but it does not verify:

- Supabase Edge Functions
- document processing integration
- NLP service endpoints
- quiz generation end-to-end
- AI tutor flows
- auth/session resilience behavior in the browser

### Impact

- Core platform claims depend heavily on manual verification.
- The adaptive quiz gap above could exist without failing the current test suite.
- Regressions in document processing, quiz generation, and service integration can slip through.

### Recommended next work

1. Add test coverage for Edge Function request/response behavior.
2. Add at least one integration test for quiz generation payload shaping.
3. Add smoke tests for the NLP service endpoints used by Supabase functions.
4. Add browser-level verification for login, file processing, and quiz generation.

## Gap 4: Local runtime version is below Vite's stated requirement

### What was found

`npm run build` succeeds locally, but Vite emits this warning:

- current Node.js: `20.13.1`
- required by Vite: `20.19+` or `22.12+`

### Impact

- The project can appear healthy while still running on an unsupported Node version.
- Local or CI behavior may drift as tooling becomes stricter.
- Future build or dev-server issues may be harder to diagnose because the environment is already outside the stated requirement.

### Recommended next work

1. Upgrade local and CI Node versions to a supported release.
2. Document the expected Node version in README or project setup docs.
3. Consider an `.nvmrc` or equivalent version pin.

## Verification Snapshot

Commands run during this review:

- `npm test`
- `npm run build`

Observed results:

- tests passed: 73/73
- production build succeeded
- Vite reported an unsupported Node version warning

## Suggested Priority

1. Gap 1: adaptive quiz generation wiring
2. Gap 3: automated verification coverage
3. Gap 2: overview documentation drift
4. Gap 4: Node/Vite environment mismatch

