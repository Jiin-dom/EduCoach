# Quiz Question Quality Improvement

## Date
2026-04-29

## App Affected
Both (`educoach` and `educoach-mobile` via shared Supabase/NLP backend)

## Type of Work
Quality improvement / fix

## Summary

Improved the quality of NLP-generated quiz questions by adding deterministic failure reasons (`too_short_stem`, `article_mismatch`, `multiple_choice_blank_shape`, `risky_entity_swap`, `missing_participle`, and `peripheral_concept`), replacing robotic question templates with natural comprehension-oriented wording, enforcing stricter minimum description quality gates, fixing `a/an` article agreement after True/False entity swaps, extracting clean description clauses via partial concept name stripping, stripping leading slide sequence markers, preventing fill-in-the-blank questions from generating multi-sentence stems, and forcing targeted Gemini QA only for suspicious candidates. When Gemini QA is unavailable, candidates that required Gemini review are now dropped instead of being saved on confidence alone.

## Problem Being Solved

After the targeted Gemini QA pipeline was deployed (same day, earlier session), all NLP-generated question candidates still scored `confidence >= 0.750`, meaning Gemini QA never triggered (`geminiQaReviewed=0`). The questions were technically well-formed but pedagogically poor:

- Identification questions were bare definition regurgitations ("Name the concept defined as: an optimization algorithm used to find the minimum of a function")
- Some descriptions were too vague to uniquely identify a concept ("a key algorithm for training neural networks" — could be Gradient Descent, Backpropagation, or SGD)
- Templates sounded robotic ("Which concept is defined as:", "Which option matches this definition:")
- After fixing the templates, True/False questions broke `a/an` article agreement after entity swaps ("An Backpropagation introduces non-linearity")
- Descriptions with leading subjects matching partial concept names were not stripped ("What is the term for weights are numerical values...")
- Multi-sentence paragraphs were incorrectly used as fill-in-the-blank stems, causing unnatural mid-word truncation.
- Multiple-choice stems could still contain `__________`, making MCQs look like fill-in-the-blank questions.
- Candidates with a non-empty failure reason could still score above `GEMINI_QA_THRESHOLD=0.6`, so Gemini QA did not review them.
- Slide-step source text could leak leading transitions into question stems (`Next, the...`, `Then, the...`).
- Bad but high-confidence True/False entity swaps could create misleading statements such as `Feature extraction is the ability of a computer...`.
- Malformed generated prompt clauses could still pass when they were grounded but ungrammatical (`Which concept involves an activation function introduces...`, `What concept is characterized by structured...`).
- Peripheral biology concepts could surface as general science questions instead of DNN-focused learning checks.
- When Gemini returned `503`, review-required candidates could still survive if their confidence remained above the fallback threshold.

## Scope of Changes

### NLP Service (`educoach/nlp-service/main.py`)

1. **New failure reason `too_short_stem`**: Regex patterns extract the descriptive clause from template-based question stems. If the clause has fewer than 8 meaningful content words (excluding conjunctions/prepositions), the question gets a -0.45 score penalty, pushing it below the 0.6 Gemini QA threshold.

2. **Updated identification templates** (beginner/intermediate/advanced):
   - Old: "Which term is described by this statement:", "Which concept matches this description:"
   - New: "What is the term for", "Which concept is characterized by", "What concept does this describe:"

3. **Updated slide question templates**:
   - Old: "Which concept is defined as:", "Which option matches this definition:"
   - New: "What is the term for", "Which of the following best describes", "Which concept involves"

4. **Stricter `_description_to_question_clause()`**: Returns empty string if the clause after stripping the concept name has fewer than 8 content words. Now correctly handles partial concept name matches (e.g. stripping "Weights" when concept is "Weights and Bias") and falls back to stripping generic Subject + Linking Verb prefixes to prevent "What is the term for [Concept] is a..." grammar errors.

5. **Stricter viable concept filter in `_generate_slide_questions()`**: Calls `_description_to_question_clause()` during the filter pass so concepts with inadequate descriptions are rejected early.

6. **Added `_fix_article_agreement()`**: Corrects a/an agreement for the first word in a sentence after an entity swap in a False statement. Also added `article_mismatch` as a severe penalty score (-0.55).

7. **Added `_truncate_to_first_blank_sentence()`**: Prevents multi-sentence text fragments from becoming Fill in the Blank stems by truncating at the first sentence boundary after the blank.

8. **Widened `_EMBEDDED_SENTENCE_PROMPT_RE`**: Catches the new template phrasing when sentences are inappropriately embedded.

9. **Added `_GEMINI_QA_FORCE_REVIEW_REASONS` and `_should_gemini_review()`**: Keeps the threshold at `0.6` for speed, but forces Gemini QA for selected suspicious reasons such as `source_fragment`, `weak_distractors`, `invalid_type_shape`, `multiple_choice_blank_shape`, and `answer_not_grounded`.

10. **Added `multiple_choice_blank_shape`**: Multiple-choice questions containing `__________` are now invalid and score low enough for Gemini repair or final rejection. This prevents fill-in-the-blank-looking stems from being saved as MCQs.

11. **Added `_LEADING_TRANSITION_RE`**: Strips leading slide sequence words such as `Next,`, `Then,`, `Finally,`, `After that`, and `Afterwards` during sentence sanitization so quiz stems do not preserve slide-step narration.

12. **Added `risky_entity_swap`**: Flags high-risk True/False entity swaps that pair unrelated course terms with AI definitions, for example `Feature extraction is the ability of a computer to perform tasks commonly associated with intelligent beings.`

13. **Added `missing_participle`**: Flags malformed generated prompt clauses such as `Which concept involves an activation function introduces...` and `What concept is characterized by structured...`.

14. **Added `peripheral_concept`**: Flags broad source facts such as `fundamental unit of the nervous system` unless the question stem anchors them back to AI, machine learning, DNNs, or neural networks.

15. **Changed Gemini-unavailable filtering**: If `geminiQaUnavailable=true`, any candidate where `_should_gemini_review(q)` is true is dropped with a `qa_required_unavailable` log line, even if its confidence is above `qa_min_confidence`.

### Edge Function (`educoach/supabase/functions/generate-quiz/index.ts`)

16. **Added `too_short_stem`, `article_mismatch`, `multiple_choice_blank_shape`, `risky_entity_swap`, `missing_participle`, and `peripheral_concept` to `SEVERE_FAILURE_REASONS`**: Even if a question with one of these reasons somehow passes the NLP service, the edge function will block it.

### Tests (`educoach/src/test/targetedGeminiQuizPipelineSource.test.ts`)

17. **Updated template and QA-routing assertions**: Test expectations now match the new template wording and verify that suspicious deterministic reasons force Gemini QA without raising the global threshold.

18. **Added regression assertions for the latest server logs**: Tests now require transition stripping, risky entity-swap detection, and `qa_required_unavailable` filtering when Gemini is down.

## Files/Modules Affected

- `educoach/nlp-service/main.py`
- `educoach/supabase/functions/generate-quiz/index.ts`
- `educoach/src/test/targetedGeminiQuizPipelineSource.test.ts`

## Supabase Impact

- **Schema changes**: None
- **Policy changes**: None
- **Auth changes**: None
- **Storage changes**: None
- **API/query changes**: NLP service returns new failure reasons `too_short_stem`, `article_mismatch`, `multiple_choice_blank_shape`, `risky_entity_swap`, `missing_participle`, and `peripheral_concept` in candidate scoring. Edge function recognizes them as severe.

## User-Facing Behavior Changes

- Quiz questions will use more natural, comprehension-oriented wording instead of robotic "defined as:" patterns
- Questions based on vague/generic concept descriptions will be filtered out (quiz may have fewer questions from poorly-described concepts, but remaining questions will be higher quality)
- Gemini QA is more likely to trigger for borderline questions due to targeted forced review of suspicious failure reasons, without reviewing every clean candidate
- Multiple-choice questions should no longer display fill-in-the-blank-style `__________` stems
- Question stems should no longer start with slide-step transitions like `Next,` or `Then,`
- If Gemini QA is unavailable, candidates that required Gemini repair are dropped instead of being saved
- Peripheral concepts are less likely to appear unless the question connects them back to the course topic

## Developer Notes / Architectural Decisions

- The `_MIN_STEM_DESCRIPTION_WORDS = 8` threshold was chosen because descriptions under 8 content words are almost always too generic to uniquely identify a concept
- The `_TOO_SHORT_STEM_PATTERNS` regex list extracts the descriptive portion from both old and new template patterns for backward compatibility
- `_description_to_question_clause()` now acts as both a transformer AND a gate — this is intentional to catch inadequate descriptions at the earliest possible point
- `GEMINI_QA_THRESHOLD` remains at `0.6` to avoid making every borderline-but-clean question depend on Gemini latency. Forced review is reason-based and batched in the existing single targeted Gemini QA request.
- The Gemini-unavailable branch now prioritizes quality over count: if a question needed Gemini review but Gemini returned `503`, the candidate is discarded instead of accepted by confidence score alone.
- `qa_required_unavailable` is a log marker, not a stored database field. It is intended to make deployed server logs explain why question counts may drop during Gemini outages.

## Testing/Verification Performed

- Python syntax: `python3 -m py_compile educoach/nlp-service/main.py` passes
- Full web test suite: `npm test` passes (146 tests across 14 test files)
- Focused tests: `npm test -- src/test/targetedGeminiQuizPipelineSource.test.ts` passes (15 tests)

## Known Limitations

- The 8-word minimum may reject some legitimately short but precise descriptions (e.g., acronym-heavy technical terms). This can be tuned via `_MIN_STEM_DESCRIPTION_WORDS`.
- When Gemini is unavailable and many candidates require review, quiz generation may return fewer than the requested question count. That is intentional until a safe deterministic backfill is added.
- These changes need deployment to the server (`docker compose up -d --build nlp-service` and `supabase functions deploy generate-quiz`) before they take effect.
- The existing `npm run build` TypeScript issues in `educoach` and `npx tsc --noEmit` issues in `educoach-mobile` are pre-existing and unrelated.

## Follow-Up Tasks

1. **Deploy and test**: Rebuild NLP service container and redeploy edge function, then generate a quiz with the same DNN document to verify improved question quality
2. **Monitor Gemini QA activation**: Check if `geminiQaReviewed > 0` in quality metrics after deployment — suspicious candidates with forced-review reasons should now trigger Gemini even when confidence is `0.750`
3. **Avoid raising `GEMINI_QA_THRESHOLD` unless needed**: The preferred path is reason-based forced review because it protects speed better than reviewing all candidates below a higher threshold
4. **Consider a "final polish" Gemini pass**: A bounded pass that only rewrites the final 5 questions would improve phrasing without the performance regression of full-quiz enhancement
