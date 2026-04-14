# Quiz Question-Type Allocation Behavior

## Purpose

This document describes the implemented behavior for quiz question-type allocation in EduCoach, including:
- how question-type counts are determined
- how odd totals are handled
- how shortfalls are rebalanced
- where each part is implemented

## What Changed

EduCoach now uses a **deterministic, balanced allocation** for selected quiz types instead of relying on emergent/random distribution.

When a user selects:
- total question count (`N`)
- one or more question types

the system computes explicit per-type targets and attempts to satisfy them across NLP and fallback paths.

## Allocation Rule

Given:
- `N` = requested total question count
- `k` = number of selected types

The allocation is:
- `base = floor(N / k)`
- `remainder = N % k`
- each selected type gets `base`
- first `remainder` selected types get `+1`

### Stable order for remainder assignment

Remainders are assigned in fixed order (not click order):
1. `multiple_choice`
2. `true_false`
3. `fill_in_blank`
4. `identification`

Examples:
- `N=10`, types=`[multiple_choice, true_false]` -> `5 / 5`
- `N=15`, types=`[multiple_choice, true_false]` -> `8 / 7`

## User-Facing Behavior (Modal)

In the quiz generation modal:
- users still choose total count, difficulty, and types
- the UI now shows a live breakdown preview, for example:
  - `Breakdown: 8 Multiple Choice, 7 True/False`

If no type is selected, generation is blocked with the existing validation error.

## Backend Enforcement

Even if the client sends targets, the Edge Function recomputes targets server-side as source of truth.

Behavior:
1. Edge computes deterministic targets from `questionCount + questionTypes`.
2. Edge sends `question_type_targets` to NLP `/generate-questions`.
3. NLP preferentially generates toward remaining quotas.
4. If NLP returns short, Edge runs deterministic supplementation:
   - first fill missing requested quotas by type
   - then rebalance remaining gap in stable order across selected types
5. Only selected question types are allowed.

## Gemini Fallback Behavior

When generation falls back to Gemini:
- prompt now includes exact target counts per type when available
- instead of generic “mix roughly evenly”

This keeps fallback behavior aligned with deterministic targets.

## Files Involved

### Frontend
- `src/lib/quizAllocation.ts`
  - deterministic balanced target computation
  - human-readable breakdown formatting
- `src/components/files/GenerateQuizDialog.tsx`
  - live breakdown preview
  - sends targets during generate request
- `src/hooks/useQuizzes.ts`
  - request contract includes `questionTypeTargets`

### Edge Function
- `supabase/functions/generate-quiz/quizAllocation.ts`
  - deterministic target helper for backend
  - type counting helper
- `supabase/functions/generate-quiz/index.ts`
  - recomputes targets server-side
  - passes quotas to NLP
  - supplements/rebalances on shortfall
  - aligns Gemini fallback with targets

### NLP Service
- `nlp-service/main.py`
  - accepts `question_type_targets`
  - generates with quota-aware type selection
  - reports requested type targets in stats

## Notes

- Full run-to-run determinism still depends on randomized internals in generation; this implementation guarantees deterministic **target allocation** and deterministic **rebalance order**.
- Existing validation and quality filtering remain in place (deduplication, malformed question filtering, T/F declarative checks).

