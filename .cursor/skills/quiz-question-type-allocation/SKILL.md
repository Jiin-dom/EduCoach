---
name: quiz-question-type-allocation
description: Defines deterministic allocation rules for splitting a requested quiz question count across selected question types (e.g., MCQ vs True/False), including odd totals and generation shortfalls. Use when designing or updating quiz generation UX/backend, writing acceptance criteria for question type mixing, or debugging mismatched question-type distributions.
---

# Quiz Question Type Allocation

## Quick Start

When a user selects multiple quiz question types plus a total question count, do not leave the resulting mix to “whatever the generator returns.”

Instead:
- compute an explicit **target allocation** by type
- generate or select questions to meet those targets
- define a deterministic shortfall policy
- make the behavior testable (requested vs actual by type)

## Core Behavioral Rules

### Deterministic “balanced” allocation (default)

Inputs:
- total requested \(N\)
- selected type list \(T\)

Rules:
- base = floor(\(N / |T|\))
- remainder = \(N \bmod |T|\)
- Each selected type gets `base`
- The first `remainder` types (in stable order) get `+1`

### Stable order (for remainder + rebalancing)

Never use checkbox click order. Use fixed order:
1. `multiple_choice`
2. `true_false`
3. `fill_in_blank`
4. `identification`

Filter down to the user-selected subset to get the stable order.

### Type constraints are strict

- The quiz may include **only** the selected types.
- If a type cannot be generated, shortfall must be reallocated only to other selected types.

### Shortfall policy (preferred)

If one or more types cannot meet targets:
- keep total count at \(N\) by reallocating to other selected types
- fill missing questions one-at-a-time in stable order
- record stats: requested targets vs actual by type
- show a user-facing note only when deviation is meaningful

## Output Template (when writing a spec or acceptance criteria)

Use this structure:
- **Trigger**: user clicks Generate with N, difficulty, selected types
- **Expected behavior**: deterministic target allocation computed
- **Odd totals**: remainder assignment rule + examples
- **Shortfalls**: rebalancing rules + user-facing messaging
- **Telemetry**: requested vs actual counts by type

## References

- For the full behavioral spec (copy/paste baseline), see `behavioral-spec-writing/behavioral-spec-writing/quiz-question-type-allocation.md`.

