# EduCoach Learning Path Intention vs Implementation Audit

Date: 2026-04-28  
Scope checked:
- Intended behavior docs:
  - `docs/info/learning-path-explanation.md`
  - `docs/info/learning-path-agent-instructions.md`
- Implementation:
  - web (`src/*`)
  - mobile (`educoach-mobile/src/*`)
  - Supabase migrations/functions (`supabase/*`)
- Related docs under `docs/` for consistency

---

## Executive Verdict

The current Learning Path implementation is **largely aligned in core adaptive logic** (topic-level tracking, incremental mastery, weak-topic prioritization, and adaptive replanning), but there are **important gaps** against your intended behavior:

1. **Preferred study time window is not used in scheduler logic** (only study days + daily minutes are used).
2. **“All topics always in rotation” is not strictly enforced at adaptive task level** (adaptive concept selection is capped).
3. **Output labeling differs** from your intended weak/medium/strong priority labels (system uses `reason` + numeric priority).
4. **Some behavioral docs inside `docs/implementation/` describe stricter behavior than current code guarantees** (especially session checkpoint stability and full availability-time-window use).

---

## Alignment Matrix (Intended vs Actual)

### 1) Task Generation (What to Study)

**Intended**
- Generate quiz/flashcards/review tasks from topic mastery and weaknesses.

**Current Implementation**
- Implemented with persistent adaptive tasks (`quiz`, `flashcards`, `review`) and concept-focused task metadata.
- Adaptive reasons are ranked (`due_today`, `needs_review`, `developing`).

**Evidence**
- `src/hooks/useAdaptiveStudy.ts`
- `supabase/migrations/024_adaptive_study_tasks.sql`
- `supabase/migrations/030_restore_adaptive_sync_guards_on_document_delete.sql`

**Status:** Aligned

---

### 2) Initial State (No Performance Data Yet)

**Intended**
- Baseline tasks evenly distributed, neutral priority, immediate study plan.

**Current Implementation**
- Baseline placeholders are created in `user_concept_mastery` (`mastery_score=50`, `total_attempts=0`, `developing` planning reason in adaptive tasks).
- Scheduling is done within goal window and available study days.

**Evidence**
- `src/services/goalWindowScheduling.ts`
- `supabase/migrations/027_adaptive_tasks_bootstrap_without_weak_area_reason.sql`

**Status:** Mostly aligned (baseline exists and is neutral; exact “evenly distributed across all topics” is approximated by seeded priority + capacity slots)

---

### 3) Topic-Level Performance Tracking

**Intended**
- Track correct/incorrect, attempts, recency per topic from all task types.

**Current Implementation**
- Quiz and flashcard interactions both write to `question_attempt_log`.
- Mastery is recomputed per concept (topic-level unit in code).

**Evidence**
- `src/hooks/useLearning.ts`
- `src/hooks/useFlashcards.ts`
- `supabase/migrations/006_learning_intelligence.sql`
- `supabase/migrations/013_question_attempt_log_source_split.sql`

**Status:** Aligned

---

### 4) Incremental Mastery (No one-shot mastery jump)

**Intended**
- Mastery grows gradually with repeated success and recency.

**Current Implementation**
- WMS blends recent attempts + confidence + neutral baseline (50).
- Confidence ramps with attempt count, blocking instant high mastery.

**Evidence**
- `src/lib/learningAlgorithms.ts`

**Status:** Aligned

---

### 5) Weakness Prioritization + Spaced Repetition

**Intended**
- Weak topics more frequent; strong topics less frequent but still revisited.

**Current Implementation**
- Priority score uses weakness + deadline pressure + low-practice penalty.
- SM-2 updates `repetition`, `interval_days`, `due_date`, `ease_factor`.
- Adaptive tasks focus top actionable concepts (capped set).

**Evidence**
- `src/lib/learningAlgorithms.ts`
- `src/hooks/useLearning.ts`
- `supabase/migrations/030_restore_adaptive_sync_guards_on_document_delete.sql`

**Status:** Partially aligned  
**Gap:** Strong topics are not guaranteed to appear in every adaptive projection cycle because adaptive concept selection is capped.

---

### 6) Deadline-Aware Scheduling

**Intended**
- Far deadline: spaced schedule. Near deadline: compressed and intensified.

**Current Implementation**
- Scheduler uses goal window (`today -> exam_date`), available days, and daily capacity.
- Priority score includes deadline pressure.

**Evidence**
- `src/services/goalWindowScheduling.ts`
- `src/lib/learningAlgorithms.ts`
- `src/hooks/useGoalWindowScheduling.ts`

**Status:** Aligned at date-level scheduling

---

### 7) Manual Task Integration

**Intended**
- Manual quizzes/flashcards count as valid performance data.

**Current Implementation**
- Quiz attempts and flashcard reviews both feed `question_attempt_log` and mastery recomputation.
- Manual adaptive task rescheduling is preserved.

**Evidence**
- `src/hooks/useLearning.ts`
- `src/hooks/useFlashcards.ts`
- `supabase/migrations/028_manual_adaptive_task_rescheduling.sql`

**Status:** Mostly aligned  
**Gap:** “Manual task” as a first-class planner entity is less explicit than “manual interaction contributes to mastery.”

---

### 8) Continuous Feedback Loop

**Intended**
- After each interaction, update mastery, reprioritize, regenerate/reschedule tasks.

**Current Implementation**
- Implemented through quiz/flashcard mutations, mastery recompute, adaptive sync, and query invalidation/refetch.

**Evidence**
- `src/hooks/useLearning.ts`
- `src/hooks/useFlashcards.ts`
- `src/hooks/useAdaptiveStudy.ts`
- `supabase/migrations/024_adaptive_study_tasks.sql`

**Status:** Aligned

---

### 9) Constraints: Respect Availability and Avoid Overload

**Intended**
- Respect available study days + preferred time + feasible daily workload.

**Current Implementation**
- Respects available study days.
- Uses `daily_study_minutes` to compute per-day capacity (`~30 min/session` heuristic).
- Uses preferred study start/end as an in-day placement constraint for learning-path items.
- Falls back gracefully when preferred window is missing/invalid/too small while still honoring `daily_study_minutes`.

**Evidence**
- `src/services/goalWindowScheduling.ts`
- `src/components/profile/ProfileContent.tsx`
- `supabase/migrations/012_study_time_preferences.sql`

**Status:** Aligned  
**Gap:** No persisted DB-level time field yet (`due_date`/`scheduled_date` remain date-only), so time placement is computed at planning/render time.

---

### 10) Expected Outputs

**Intended**
- Tasks per day, topic focus, priority level (`weak/medium/strong`), adjusted schedule.

**Current Implementation**
- Tasks are date-based with concept focus and numeric priority.
- Priority labels are not exposed as `weak/medium/strong`; system uses `reason` and `priorityScore`.

**Evidence**
- `src/hooks/useAdaptiveStudy.ts`
- `src/lib/learningPathPlan.ts`
- `src/components/learning-path/LearningPathCalendar.tsx`

**Status:** Partially aligned  
**Gap:** Label taxonomy mismatch for priority levels.

---

## Cross-Check of Other `docs/` vs Code

### A) Docs that are consistent with current implementation

- `docs/implementation/adaptive-study-tasks-behavioral-spec.md` is broadly consistent on persistent adaptive tasks, reason/status lifecycle, and document-scoped sync.
- `docs/implementation/learning-path-replanning-behavioral-spec.md` is broadly consistent on triggers and replanning flow.
- `docs/learning-path-web-mobile-parity.md` correctly identifies web/mobile parity as partial (especially planning UX).

### B) Docs that currently overstate behavior vs implementation

1. **Time window scheduling claims are stronger than code reality**
   - Some docs say scheduling uses `preferred_study_time_start/end`.
   - Code currently schedules by date/day/capacity, not by time-window slots.

2. **Session checkpoint stability is described more strongly than clearly centralized in implementation**
   - Specs describe strict “stable during active assessment session” checkpoint behavior.
   - Current behavior relies on query invalidation patterns and selective invalidation controls; there is no single authoritative checkpoint subsystem visible in inspected implementation.

3. **“All topics always in rotation” is stated as a hard rule in intent docs**
   - Adaptive task projection currently prioritizes top actionable concepts (bounded scope), which can exclude some strong topics in a given cycle.

---

## Misalignment / Gap List

## P0 (High Impact)
- **Preferred study time window not implemented in scheduler**
  - Impact: schedule may be valid by day but not by intended study-time constraints.

## P1 (Medium Impact)
- **Adaptive rotation cap can conflict with strict all-topics-in-rotation expectation**
  - Impact: students may not see explicit reinforcement tasks for some strong topics in adaptive queue cycles.

- **Priority label mismatch (`weak/medium/strong` vs `reason` + numeric score)**
  - Impact: product language and user-facing explanation can drift from intended model.

## P2 (Lower / Documentation-Architecture)
- **Behavioral docs imply stricter session checkpoint guarantees than currently obvious in code organization**
  - Impact: confusion during QA and regressions if expectations are interpreted as already fully enforced.

---

## What Is Working Well (Aligned Core)

- Topic-level learning intelligence pipeline is implemented and active.
- Incremental mastery and anti-one-shot-mastery behavior are correctly implemented.
- SM-2 spaced repetition is integrated into concept due-date evolution.
- Adaptive tasks are persisted server-side (not purely client-derived).
- Feedback loop from quiz/flashcard activity to plan updates is functioning.

---

## Recommended Next Actions

1. **Implement scheduler support for preferred study time window** (or revise intent docs to clarify “date-only scheduling”).
2. **Decide product rule for strong-topic reinforcement visibility**:
   - strict all-topic rotation in adaptive queue, or
   - bounded adaptive queue + separate reinforcement stream.
3. **Standardize priority semantics across docs/UI/data**:
   - either expose `weak/medium/strong` labels in UI/data model, or
   - update docs to formalize `reason` + numeric priority.
4. **Clarify and harden session checkpoint behavior** in one explicit subsystem (or document current guarantees as best-effort).

---

## Quick Acceptance Recheck Template

Use this as a release checklist for alignment:

- [ ] Baseline plan appears immediately after upload with neutral reasoning.
- [ ] Quiz + flashcard interactions both update concept mastery.
- [ ] Mastery does not jump to high after a single correct response.
- [ ] Weak concepts move earlier/higher in plan priority.
- [ ] Strong concepts still receive reinforcement under defined policy.
- [ ] Replanning honors available study days.
- [ ] Replanning honors preferred study time window (or docs explicitly state not supported).
- [ ] Learning Path output fields match documented priority model.
- [ ] Active session stability behavior is tested and documented.

