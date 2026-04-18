# Learning Path Parity Audit (Web vs Mobile)

Date: 2026-04-16  
Scope: `src/components/learning-path/*`, `src/pages/LearningPathPage.tsx` vs `educoach-mobile/src/screens/LearningPathScreen.tsx` and related mobile learning-path components/hooks.

## Verdict

Learning Path parity is **partial**.  
Core scheduling/mastery logic is mostly shared, but the product experience is **not 1:1**:

- Web ships a clear 3-tab IA (`Schedule`, `Topics & Mastery`, `Goals & Planning`).
- Mobile currently ships a goal-selection flow + 2-tab detail experience (`schedule`, `mastery`) and routes goal management to Library/files.
- Several goal/planning render branches exist in mobile code but are not part of active tab flow.

---

## Method

Compared:

- Route/screen entry points
- Information architecture and navigation model
- Schedule/calendar capabilities
- Mastery capabilities
- Goals/planning capabilities
- Action semantics (review generation, replan, rescheduling)
- Empty/loading/error behavior
- Data plumbing/hook parity

Primary files reviewed:

- Web:
  - `src/pages/LearningPathPage.tsx`
  - `src/components/learning-path/LearningPathCalendar.tsx`
  - `src/components/learning-path/LearningPathContent.tsx`
  - `src/components/learning-path/StudyGoalsPanel.tsx`
  - `src/hooks/useLearningPathPlan.ts`
- Mobile:
  - `educoach-mobile/src/screens/LearningPathScreen.tsx`
  - `educoach-mobile/src/components/learning-path/LearningPathCards.tsx`
  - `educoach-mobile/src/components/learning-path/LearningPathPlanWidgets.tsx`
  - `educoach-mobile/src/components/learning-path/LearningPathSkeleton.tsx`
  - `educoach-mobile/src/hooks/useLearningPathPlan.ts`

---

## 1) Information Architecture Parity

### Web

- Explicit page-level tabs:
  - `schedule` -> `LearningPathCalendar`
  - `mastery` -> `LearningPathContent`
  - `planning` -> `StudyGoalsPanel`

### Mobile

- Two-stage experience:
  - Stage A: choose a goal/document card first.
  - Stage B: document-scoped detail UI with tab-like switch for `schedule` and `mastery`.
- No active top-level `goals` tab in `LearningTab` type (`'schedule' | 'mastery'`).
- Goals are managed through Library/files entry points (`openLibrary`, `openDocument`) rather than an in-screen dedicated planning panel equivalent to web `StudyGoalsPanel`.

### Parity Assessment

- **Not 1:1** in IA.
- Mobile flow is document-centric; web flow is section-centric (global schedule/mastery/planning).

---

## 2) Data/Plan Engine Parity

### Shared strengths

- Both platforms use `useLearningPathPlan` backed by `buildLearningPathPlan`.
- Both include mastery rows, adaptive tasks, documents, quizzes as plan inputs.
- Both expose loading/error aggregation from the four source queries.

### Minor implementation drift

- Mobile normalizes mastery rows via `toPlanMastery` before passing to planner.
- Web passes query rows directly.

### Parity Assessment

- **High parity** on planner data model and computed plan semantics.

---

## 3) Schedule View Parity

### Web schedule (`LearningPathCalendar`)

- Week/month switching
- Date navigation
- Day-cell rendered items:
  - planned reviews
  - goal markers
  - adaptive tasks
- Drag/drop rescheduling of planned reviews
- Mastery-level filters (mastered/developing/needs_review)
- Replan CTA using profile availability/day-minutes
- AI recommendation card + quick actions sidebar widgets

### Mobile schedule (`LearningPathScreen`)

- Week/month switching
- Date navigation
- Date cell agenda and event rendering
- Due-today quizzes card
- Focus filters (`all`, `due`, `review`, `developing`)
- Start review session action
- Replan CTA from availability
- Long-press concept agenda to open due-date rescheduler modal

### Notable differences

- Web drag/drop direct manipulation; mobile uses explicit reschedule modal flow.
- Mobile schedule is scoped through selected goal/document; web calendar is globally visible by default.
- Web side widgets (legend/summaries/quick actions) are structurally different from mobile’s card stack.

### Parity Assessment

- **Functional parity: medium-high**
- **Interaction parity: low-medium** (same outcomes, different mechanics and scope)

---

## 4) Mastery View Parity

### Web mastery (`LearningPathContent`)

- Weekly progress summary
- Adaptive Study Queue with task-specific actions
- Generated Plan (baseline planned reviews + goal markers)
- Prioritized sections:
  - Due Today
  - Needs Review
  - Developing
  - Mastered
- Concept detail dialog with SM-2 internals, confidence, stored/display mastery mismatch explanation
- Review quiz generation CTA

### Mobile mastery (`LearningPathScreen` + cards/widgets)

- Weekly pulse/readiness/stats
- Adaptive queue cards + actions
- Generated plan cards (baseline + goal markers)
- Active topics list (priority order)
- Review CTA
- Concept detail modal with deep mastery fields and progress details

### Differences

- Web explicitly exposes four mastery sections; mobile collapses into "active topics" presentation plus summary cards.
- Copy and hierarchy differ; core intent overlaps.

### Parity Assessment

- **High functional parity** with moderate UX divergence.

---

## 5) Goals & Planning Parity (Largest Gap)

### Web (`StudyGoalsPanel`)

- First-class planning workspace:
  - File study goals management
  - Quiz deadline management
  - Set/edit/delete goal dialog
  - Goal labels and deadline labels
  - Integrated summary/exam management panel
- Goal CRUD is directly accessible from Learning Path page.

### Mobile (`LearningPathScreen`)

- Goal selection cards and goal-progress drilldown exist.
- In-screen text/actions route to Library/files for management.
- Active `contentItems` generation only handles `schedule` and `mastery`.
- `goals*` render item handlers exist in code (`goalsHero`, `goalsFileHeader`, `goalFile`, `goalDeadline`, etc.) but are not part of active tab selection path.

### Parity Assessment

- **Low parity** for planning/goals user experience.
- This is the primary reason Learning Path is not 1:1.

---

## 6) Action-Level Behavior Parity

### Start review quiz

- Both: compute reviewable concepts and generate targeted review quiz.
- Both: navigate into quiz flow after generation.

### Adaptive task handling

- Both: support task type routing (`quiz`, `flashcards`, concept review), with generation/ready states.

### Replan from profile availability

- Both: call replan mutation with available study days and daily minutes.

### Rescheduling due dates

- Web: drag/drop onto day cells.
- Mobile: dedicated picker modal from long-press.

### Assessment

- **Outcome parity mostly present**, but UX mechanics differ substantially.

---

## 7) UX/State Parity

- Loading skeletons: both have dedicated loading treatments.
- Empty states: both cover no-plan/no-topics/no-goals-like conditions.
- Errors:
  - Web leans on inline cards and toasts.
  - Mobile leans on card states + toast context.
- Mobile adds hardware-back handling and goal-selection shell behavior not mirrored in web.

Assessment: **acceptable divergence**, not a blocker by itself.

---

## 8) Confirmed Non-Parity Findings

1. **No active goals/planning tab in mobile Learning Path detail flow** (only `schedule` and `mastery` states used).
2. **Web has direct goal/deadline CRUD in Learning Path**, mobile routes that responsibility to files/library.
3. **Mobile includes goals render branches not wired into active content flow**, indicating implementation drift or incomplete integration.
4. **Global vs document-scoped default context differs** (web global LP tabs vs mobile goal-first/document-first workflow).

---

## 9) Parity Score (Learning Path only)

- Data/planner engine parity: **90%**
- Schedule outcome parity: **80%**
- Mastery outcome parity: **85%**
- Goals/planning parity: **45%**
- End-to-end Learning Path parity (weighted): **~70%**

---

## 10) Recommended Path to True 1:1

Priority order:

1. **Decide canonical Learning Path IA**
   - Either:
     - bring mobile to explicit 3-tab model (`schedule`, `mastery`, `planning`), or
     - intentionally adopt document-first model on web too.
2. **Unify goals/planning surface**
   - Expose full goal/deadline CRUD in mobile Learning Path (not only via Library), or classify as intentional platform divergence.
3. **Remove dead/inactive goals render branches in mobile OR wire them**
   - Avoid hidden capability confusion.
4. **Define interaction parity rules**
   - If drag/drop remains web-only, document modal reschedule as mobile-equivalent accepted divergence.
5. **Ship parity acceptance checklist**
   - Track each behavior as `matched`, `equivalent`, `intentionally diverged`, or `missing`.

---

## 11) Suggested Acceptance Checklist

- [ ] Mobile Learning Path exposes an explicit planning/goals workspace equivalent to web `StudyGoalsPanel`.
- [ ] Goal CRUD (create/edit/remove file goals and quiz deadlines) is directly available inside Learning Path on both platforms.
- [ ] Both platforms support replan from availability with equivalent success/failure UX.
- [ ] Both platforms support concept rescheduling with documented equivalent interaction.
- [ ] Both platforms present comparable schedule scope defaults (global vs selected-goal context decision finalized).
- [ ] Any intentional divergence is documented in product spec.

---

## 12) Related: Library / file delete and adaptive tasks

Deleting study materials affects adaptive tasks and cached Learning Path inputs. Web vs mobile client behavior and the database migration that fixes delete-time FK errors on `adaptive_study_tasks` are documented in:

- `docs/completed/2026-04-18/2026-04-18-library-document-delete-db-and-mobile.md`

