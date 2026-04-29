# Targeted Gemini Quiz Quality and Speed

## Date

2026-04-29

## App affected

Both `educoach` and `educoach-mobile`.

## Type of work

Backend, performance, feature.

## Summary of what was implemented

Quiz generation now keeps Gemini for coherence, but moves the normal QA/repair pass into the NLP service and only sends low-confidence candidates to Gemini. The Supabase edge function no longer runs full-quiz Gemini enhancement plus full-quiz validation after NLP success.

## Problem being solved

Quiz generation was slow on both web and mobile because the shared `generate-quiz` edge function could call Gemini repeatedly after NLP had already produced questions. This was especially painful when Gemini returned transient 503 or quota-pressure responses.

## Scope of changes

- Added source context, confidence scores, and concrete failure reasons to NLP-generated quiz candidates.
- Added deterministic question scoring for source quality, answerability, grounding, type validity, distractors, and readability.
- Added targeted Gemini QA/repair in the NLP service for candidates below the confidence threshold.
- Replaced the process-wide AQG lock with a bounded semaphore controlled by `AQG_MAX_CONCURRENT`.
- Simplified `generate-quiz` so the NLP-success path uses one NLP request and final deterministic safety filtering.
- Kept `question_context` internal for scoring, storage, and Gemini repair instead of rendering it to students.
- Tightened NLP scoring for lesson-objective sentences, code artifacts, and identification questions that contain blanks.
- Added an edge safety gate for severe NLP failure reasons before database insert.
- Added a Gemini-unavailable quality guard: if targeted QA cannot run, candidates below the QA confidence threshold are dropped instead of being saved as weak NLP-only questions.
- Added deterministic readability gates for incoherent student-facing stems, including pronoun-led true/false statements, subject-verb mismatch, and noun-phrase definition fragments.
- Reworded identification templates from source-excerpt prompts such as "Read the following" to direct student-facing questions.
- Added a `described_as_fragment` guard so direct identification prompts still reject noun-phrase fragments such as "Which topic is described as the integration of...".
- Added a `quoted_excerpt_prompt` guard so questions that still look like copied source excerpts are rejected before saving.
- Added guards for deployed screenshot regressions where slide definitions were grafted into prompts, such as "Which concept refers to Gradient Descent is...".
- Added guards for dangling conjunction stems such as sentences ending with "and." and vague demonstrative references such as "this cost function".
- Replaced slide concept templates with definition-clause prompts that strip the leading concept name and verb before embedding the definition.
- Added NLP candidate QA logging with confidence score, review threshold, failure reasons, and question text before and after Gemini QA.

## Files/modules/screens/components/services affected

- `educoach/nlp-service/main.py`
- `educoach/supabase/functions/generate-quiz/index.ts`
- `educoach/supabase/functions/generate-quiz/identificationContract.ts`
- `educoach/supabase/migrations/031_quiz_question_context.sql`
- `educoach/docker-compose.yml`
- `educoach/.env.example`
- `educoach/src/hooks/useQuizzes.ts`
- `educoach/src/components/quizzes/QuizView.tsx`
- `educoach/src/test/targetedGeminiQuizPipelineSource.test.ts`
- `educoach/src/test/generateQuizIdentificationContract.test.ts`
- `educoach/src/test/generateQuizEdgeFunctionImport.test.ts`
- `educoach/src/test/nlpIdentificationContractSource.test.ts`

## Supabase impact

- Schema changes: added nullable `public.quiz_questions.question_context TEXT`.
- Policy changes: none.
- Auth changes: none.
- Storage changes: none.
- API/query changes: `generate-quiz` inserts `question_context`; existing `select('*')` quiz question queries remain backward-compatible.
- Edge safety filtering now treats `embedded_sentence_prompt`, `dangling_conjunction`, and `vague_demonstrative_reference` as severe NLP failure reasons.

## User-facing behavior changes

- New quiz questions no longer show internal source clues to students because those clues can reveal answers.
- Identification questions now use direct wording instead of quoted source-excerpt formatting.
- Old quizzes with `question_context = null` render normally.
- Normal quiz generation should avoid the slow full-quiz Gemini enhancement and validation sequence.
- Slide-derived questions should no longer show prompts that paste a full definition sentence after "refers to" or "best described as".
- Bad stems with dangling endings or vague "this/that" references are rejected instead of shown to students.

## Developer notes or architectural decisions

- The migration is numbered `031` because this repo already has `030_*` migrations.
- `enhanceWithLlm` remains accepted by clients for compatibility, but the normal path treats quality enhancement as targeted NLP-side QA rather than full edge post-processing.
- `AQG_MAX_CONCURRENT` defaults to `2`, allowing bounded parallel quiz generation without the old global AQG serialization.
- Hosted NLP service deployments must receive `GEMINI_API_KEY`, `GEMINI_QA_ENABLED`, `GEMINI_QA_TIMEOUT_SECONDS`, `GEMINI_QA_THRESHOLD`, and `AQG_MAX_CONCURRENT`.
- A Gemini `503 Service Unavailable` is treated as provider unavailability, not successful QA. The NLP response reports `geminiQaUnavailable` and `qa_min_confidence`, and the edge function mirrors those values in quality metrics.
- Gemini QA is treated as repair assistance, not the only safety layer. The NLP service and edge function both reject severe readability failures before insert.
- Rewriting every question with Gemini is intentionally avoided by default because it would make every quiz dependent on LLM latency, especially for 10, 15, and 20 question quizzes.
- `geminiQaReviewed: 0` means no candidate fell below the NLP-side `GEMINI_QA_THRESHOLD`; the new candidate logs are intended to make that decision visible in server logs.

## Testing/verification performed

- `python3 -m py_compile educoach/nlp-service/main.py`
- `cd educoach && npm test -- src/test/targetedGeminiQuizPipelineSource.test.ts`
- `cd educoach && npm test -- src/test/generateQuizEdgeFunctionImport.test.ts src/test/targetedGeminiQuizPipelineSource.test.ts`
- `cd educoach && npm test`
- `cd educoach && npm run build` was attempted but failed on pre-existing unrelated TypeScript issues in analytics, learning-path, and `mammoth/mammoth.browser` declarations.
- `cd educoach-mobile && npx tsc --noEmit` was attempted but failed on pre-existing unrelated mobile TypeScript issues.

## Known limitations

- Targeted Gemini QA depends on `GEMINI_API_KEY` being configured in the NLP service environment.
- If Gemini QA is unavailable or times out, only deterministic candidates at or above `GEMINI_QA_THRESHOLD` continue; weaker candidates are dropped.
- The edge fallback still uses Gemini only when NLP returns zero usable questions.
- Severe NLP failures such as lesson objectives, code artifacts, and identification blanks are blocked before insert even if Gemini QA is unavailable.
- Some source decks may produce fewer than the requested number of questions if the available text is mostly fragments or vague pronoun-led statements.

## Follow-up tasks or recommended next steps

- Apply the new Supabase migration before deploying the edge function.
- Configure the hosted NLP service with the new Gemini QA environment variables.
- Clean up the existing unrelated web/mobile TypeScript errors so build verification can become strict again.
