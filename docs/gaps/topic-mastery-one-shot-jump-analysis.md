# Topic Mastery One-Shot Jump Analysis

Date: 2026-04-29  
Scope: Per-topic mastery behavior after quiz/flashcard interactions.

---

## Problem Statement

Observed behavior:
- A learner answers a topic correctly in a single quiz session.
- That topic can appear as `mastered` immediately.

Intended behavior:
- Topic mastery should increase incrementally.
- A single session should not be enough to establish high-confidence mastery.

---

## What The Implementation Was Doing

Relevant flow:
1. Quiz answers are written into `question_attempt_log` (one row per question).
2. `recomputeConceptMastery(...)` reads the latest rows for that concept.
3. `computeMastery(...)` calculates:
   - recent weighted mastery score (WMS),
   - confidence,
   - final mastery + mastery level.

Critical detail in the previous approach:
- Confidence used **raw row count** (`attempts.length`).
- For a quiz, `attempts.length` effectively meant **number of same-topic questions logged**, not number of independent learning sessions.

---

## Why This Allowed A Practical One-Shot Jump

If one quiz attempt contains multiple questions tied to the same topic:
- those multiple rows quickly raise confidence to max threshold,
- final mastery can cross the mastered boundary in that same attempt,
- resulting in practical one-shot topic mastery.

In short:
- the system treated **question volume in one attempt** as equivalent to **repeated independent evidence over time**.

---

## Root Cause

Confidence evidence unit was too granular:
- **Used:** per-question log rows.
- **Should be:** distinct learning events/sessions (for quiz, usually `attempt_id`), not row count.

---

## Computation: Before vs Now

### Before (row-count confidence)

Per-topic recompute used:
- `rawMastery = calculateTopicMastery(recentAttempts)` (WMS over recent rows)
- `confidence = calculateConfidence(attempts.length, k)`
- `finalMastery = confidence * rawMastery + (1 - confidence) * 50`
- mastery level derived from `finalMastery` + `confidence` thresholds

Where:
- `attempts.length` = number of log rows for that concept
- for quiz-heavy topics, one quiz attempt could add multiple rows and inflate confidence quickly

Practical effect:
- one good quiz with several same-topic correct answers could look like repeated evidence and jump to `mastered`.

### Now (event-count confidence)

Per-topic recompute still uses the same WMS/final formula, but confidence input changed:
- `rawMastery = calculateTopicMastery(recentAttempts)` (unchanged)
- `confidenceEvidenceCount = countDistinctEvents(recentAttempts)`
- `confidence = calculateConfidence(confidenceEvidenceCount, k)`
- `finalMastery = confidence * rawMastery + (1 - confidence) * 50`

Distinct event counting now:
- quiz rows are grouped by `attempt_id` (one quiz attempt = one confidence event)
- flashcard reviews count as separate review events
- legacy rows without source metadata fall back to timestamp-based event keys

Practical effect:
- one quiz attempt can still improve mastery score,
- but it no longer gives “full confidence” just because that attempt had many same-topic questions.

---

## What Needs To Be Changed / Adjusted

### 1) Re-define confidence evidence counting

Use distinct evidence keys per concept:
- quiz evidence key: `attempt_id` (one quiz attempt = one confidence event)
- flashcard evidence key: per review event (card review interaction)
- fallback for legacy rows without source metadata: timestamp-based fallback key

Outcome:
- one quiz attempt with many same-topic questions improves score quality, but does not instantly imply full confidence.

### 2) Keep mastery score logic, adjust confidence input

Do not remove current WMS/SM-2 behavior.
Only adjust how confidence count is derived and passed to mastery computation.

### 3) Add regression tests

Required acceptance tests:
- Single quiz attempt, many correct questions, same topic -> should **not** become `mastered` immediately (unless prior evidence already exists).
- Multiple distinct quiz attempts with consistent correctness -> can progress to `mastered`.
- Flashcard-driven progression still works over repeated reviews.

---

## Acceptance Criteria

1. Topic confidence no longer jumps to “fully confident” from one quiz attempt containing many same-topic items.
2. Topic mastery progression remains incremental across distinct attempts/reviews.
3. Existing spaced repetition and priority calculations remain intact.
4. No regressions in quiz/flashcard mastery update flow.

---

## Notes For Product/Docs

- Clarify in Learning Path docs that confidence is based on **distinct study events**, not raw question count.
- Keep expectation language: “single quiz session can improve a topic, but does not finalize mastery.”

