# Learning Path Upcoming Generation Issue

Date: 2026-04-30
Reported by: Product/User feedback
Status: Open

## Issue Summary

Learning Path currently does not reliably plot actionable upcoming tasks for `quiz`, `flashcards`, and clickable `review` entries across future days.

In practice, users mostly see non-clickable topic/concept review scheduling on later days, while clickable/adaptive quiz and flashcard behavior appears mainly right after initial file upload.

## Expected Behavior

- Upcoming days should include actionable adaptive tasks across:
  - Quiz
  - Flashcards
  - Review
- Adaptive generation should focus more on weak topics for the selected file/document.
- Reviews should remain clickable according to intended UX action.
- The plan should continue adapting after each interaction, not only immediately after upload.

## Actual Behavior

- The first upload commonly creates actionable items (baseline + adaptive sync behavior).
- After same-day quiz completion for a document, follow-up quiz generation is heavily constrained.
- Later dates frequently show planned/topic review entries instead of actionable adaptive cards.
- This makes the schedule feel like it stops generating practical tasks after day one.

## Current Implementation (As-Is)

1. **Adaptive task source is DB-driven (`adaptive_study_tasks`)**
   - Task types include `quiz`, `flashcards`, and `review`.
   - For each document, sync writes one logical task key per type and updates `scheduled_date`, `reason`, and `status`.

2. **Quiz generation is gated by status + reuse + same-day completion policy**
   - Auto-generation only runs for quiz tasks in `needs_generation` state.
   - If a reusable ready/unattempted quiz exists for the same document, generation is skipped.
   - If an adaptive quiz for that document was completed today, generation is commonly blocked/deferred.

3. **Flashcards and review are rendered from adaptive task rows, not generated like quizzes**
   - Flashcards are `ready` only when relevant flashcards exist; otherwise task may be archived.
   - Review task is `ready` and opens the concepts tab.
   - Neither uses quiz-style async generation lifecycle.

4. **Learning Path UI combines two different item families**
   - `adaptive_task` items (actionable cards for quiz/flashcards/review).
   - `planned_review` concept due-date items (can feel non-actionable compared to adaptive cards).

5. **First-upload path explicitly triggers baseline + adaptive quiz sync**
   - This is why users see strongest actionable behavior right after upload.
   - Subsequent cadence depends on policy guards and sync outputs.

## Why This Is Happening

1. **Same-day quiz generation guard is strict by document context**
   - Current policy blocks same-day regeneration in common scenarios after a completed adaptive quiz.
2. **Adaptive tasks are not effectively materialized as future actionable cadence**
   - The model often results in single-date emphasis rather than strong upcoming-day actionable distribution.
3. **Review entries shown in plan can be concept schedule items**
   - These can appear as non-actionable compared to adaptive task cards.
4. **Docs and implementation drift**
   - Intent docs describe continuous adaptive generation across task types.
   - Current flow docs/code include protective generation guardrails that reduce this behavior.

## Impact

- Reduced perceived adaptivity of Learning Path.
- Weak-topic reinforcement may feel delayed or underrepresented in actionable format.
- Users experience inconsistency: strong behavior at upload time, weaker behavior afterwards.

## Desired Direction

- Plot actionable adaptive tasks (`quiz`, `flashcards`, `review`) across upcoming days.
- Keep weak-topic-first prioritization for generation focus.
- Use a hybrid per-document same-day quiz cap:
  - default 1/day
  - allow up to 2/day when weak-topic load is high
- Keep review click action opening Concepts tab (as currently preferred).

## Related Files

- `src/pages/LearningPathPage.tsx`
- `src/hooks/useAdaptiveQuizPolicies.ts`
- `src/components/learning-path/LearningPathContent.tsx`
- `src/components/learning-path/LearningPathCalendar.tsx`
- `supabase/migrations/031_adaptive_reinforcement_slot_selection.sql`
- `docs/info/learning-path-agent-instructions.md`
- `docs/info/learning-path-and-auto-generation-current-flow.md`
- `docs/info/learning-path-intention-vs-implementation-audit.md`

