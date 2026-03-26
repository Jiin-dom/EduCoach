# Quiz Question Type Allocation Behavioral Spec

## Purpose

This spec defines the expected behavior for how EduCoach allocates a user-selected **total question count** across **selected question types** in the quiz-generation modal and generation pipeline.

It removes ambiguity like:
- “If the user selected True/False + Multiple Choice, how many of each should be created?”
- “What happens when the total is odd?”
- “What happens when the generator can’t produce enough of a selected type?”

## Trigger

The flow begins when the user clicks **Generate** in the quiz generation modal after selecting:
- total number of questions (e.g., 5/10/15/20)
- difficulty (mixed/easy/medium/hard)
- one or more question types (e.g., `true_false`, `multiple_choice`)

## Current Behavior (as implemented today)

- The UI sends only:
  - `questionCount` (max_total_questions)
  - `difficulty`
  - `questionTypes` (an allowed set)
- The NLP generator selects the question type **per question** using randomized weighted choice based on difficulty.
- Result: **no explicit, user-visible, or deterministic allocation** exists. The resulting distribution can vary run-to-run even with the same settings.

## Expected Behavior (proposed)

### Allocation principle

When the user selects multiple question types, the system should allocate the total number of questions into an explicit **target distribution** before generation.

Default allocation should be:
- **Deterministic**
- **As even as possible** across the selected types
- **Stable** across retries (same input → same target allocation)
- **Explainable** (can be shown in UI and logged in backend stats)

### Allocation algorithm (default: “Balanced”)

Given:
- \(N\) = total questions requested (integer > 0)
- \(T\) = list of selected types, in a stable order (see “Stable order” below)
- \(k = |T|\)

Compute:
- base = floor(\(N/k\))
- remainder = \(N\) mod \(k\)

Targets:
- Each type gets `base`
- The first `remainder` types in the stable order each get `+1`

Examples:
- N=10, types=[TF, MC] → TF=5, MC=5
- N=15, types=[TF, MC] → TF=8, MC=7
- N=5, types=[ID, MC, TF] → ID=2, MC=2, TF=1

### Stable order (for remainder assignment)

Remainder distribution must not depend on checkbox click order.

Use a fixed type order:
1. `multiple_choice`
2. `true_false`
3. `fill_in_blank`
4. `identification`

Filter this list down to the user-selected types to get the stable order used for allocation.

## Branches

### A. Normal path: generator meets all targets

Condition:
- The generator is able to produce at least the allocated target count for each selected type.

Expected system behavior:
- The backend generates exactly \(N\) questions.
- The final distribution matches the target allocation exactly.

Expected user-facing result:
- The quiz contains the requested total count and only the selected types.
- (Optional UX) The modal shows a preview like “10 questions: 5 MCQ, 5 True/False”.

### B. Shortfall path: generator cannot meet one or more type targets

Condition:
- For at least one selected type, the generator cannot produce enough valid questions (after validation/deduplication).

Expected system behavior:
- The backend should keep the total count at \(N\) **by rebalancing** shortfalls into other selected types.
- Rebalancing rules:
  - The quiz must contain **only** the user-selected types.
  - The system should fill missing questions using the other selected types in stable order.
  - The system should minimize deviation from the original targets (fill the smallest shortfall first, one question at a time).
- The backend should record stats:
  - requested targets by type
  - actual generated counts by type
  - which types experienced shortfalls

Expected user-facing result:
- The quiz still has \(N\) questions.
- The user is informed only if deviation is meaningful:
  - Example message (non-blocking): “We couldn’t generate enough True/False from this document, so we added 2 Multiple Choice instead.”

### C. Total shortfall: generator cannot produce \(N\) questions at all

Condition:
- Even after rebalancing across selected types, the system cannot generate \(N\) valid questions.

Expected system behavior:
- The backend returns fewer than \(N\) questions only as a last resort.
- The quiz status becomes `ready` if at least a minimum viable count is met (define threshold), otherwise `error`.
  - Suggested threshold: at least 3 questions, or at least 60% of \(N\), whichever is lower.

Expected user-facing result:
- If ready with fewer questions: show a warning indicating actual count.
- If error: show a clear retry message and guidance (“Try selecting fewer types” / “Try increasing question count” / “Re-process document”).

## State Handling Requirements

The following state must be handled correctly:
- **Selected types**: must be persisted into the generation request and used as the only allowed types.
- **Allocation targets**: must be computed once per request and logged/sent to the generator.
- **Stats**: actual counts by type must be captured and stored/returned for troubleshooting.

## Completion Criteria

The flow is complete when:
- The quiz is created with status `ready`
- Exactly \(N\) questions exist unless the system hits total shortfall branch
- The resulting question types are a subset of the user-selected types
- The final type distribution is deterministic (same inputs → same targets)

The flow is not complete if:
- The user cannot explain why a quiz ended up with a certain type mix
- The system silently deviates from the selected types
- Retries produce wildly different mixes with the same settings

## Product-Facing Result

From a product point of view:
- “Select question types” should behave like “Constrain the quiz to these types, with a predictable mix.”
- “Number of questions” should behave like “Exact total requested, unless the document can’t support it.”
- Odd totals should behave like “as even as possible,” not “random.”

## Implementation Implication

The current implementation delegates type selection to randomized per-question choice inside the NLP service.

To satisfy this spec, the system likely needs to:
- Compute a **target allocation** in the backend (Edge Function or NLP service)
- Generate questions **type-by-type** to meet targets (or post-select from an overgenerated pool and rebalance deterministically)
- Return/store stats for “requested vs actual by type”

## Acceptance Criteria

1. When a user selects N=15 and types=[`true_false`, `multiple_choice`], the quiz is generated with a deterministic target allocation and a stable, explainable result.
2. When N is odd, the remainder is assigned deterministically using the fixed stable order (not checkbox click order).
3. If one type cannot be generated sufficiently, the system rebalances to other selected types and (when meaningful) informs the user.
4. The quiz never contains question types that were not selected.
5. The system logs/returns “requested targets by type” and “actual by type” for debugging and QA verification.

## Open Questions

- Should users be able to choose an explicit mix (e.g., “More MCQ”) vs only “Balanced”?
- What is the minimum viable question count for a “ready” quiz if the document is weak?
- Should the UI show a breakdown preview before generation, or only after generation in the quiz summary?

