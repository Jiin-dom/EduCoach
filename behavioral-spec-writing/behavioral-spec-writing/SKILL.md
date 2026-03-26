---
name: behavioral-spec-writing
description: Use when the user wants a behavioral spec, expected behavior doc, branching flow spec, reconciliation behavior note, or acceptance-criteria-style explanation. Trigger for requests to classify this kind of writing, title it, turn rough notes into a flow-focused spec, or produce a reusable template for expected system and user-facing behavior.
---

# Behavioral Spec Writing

## Overview

Write outcome-first behavioral specifications that explain what should happen, when it should happen, and what the user should experience.

Focus on behavior before implementation. Start with trigger, branches, state handling, and end-state expectations. Keep the writing clear enough for product, engineering, and QA to align on the same flow.

## Workflow

### 1. Classify the request

First decide what the user is asking for:

- identify what kind of spec or explanation this is
- title an existing behavioral note
- rewrite rough notes into a clean behavioral spec
- generate a reusable template

If the user gives partial notes, treat them as source material and normalize them into a structured behavior document.

### 2. Extract the behavioral core

Pull out the key elements before writing:

- trigger event
- short handling phase, if any
- explicit branches
- state that must be set, preserved, consumed, or cleared
- product-facing outcome
- implementation implication, if relevant

If there are multiple branches, make them explicit. Do not bury them in paragraphs.

### 3. Write outcome-first

Prefer this order:

1. purpose
2. trigger
3. expected behavior
4. branch A
5. branch B and other branches if needed
6. state handling
7. completion criteria
8. product-facing result
9. implementation implication
10. acceptance criteria

Lead with what the system should do and what the user should experience. Only mention implementation after the expected behavior is already clear.

### 4. Keep the tone plain and operational

Use direct language:

- "The flow begins when..."
- "The system should..."
- "The user should see..."
- "If this does not happen..."

Avoid:

- code-heavy framing unless the user asks for it
- abstract architecture language when a simple flow statement is enough
- mixing product goals and implementation details in the same bullet

### 5. Separate behavior from implementation

Keep these distinct:

- behavioral expectation: what correct behavior looks like
- product-facing result: what the user experiences
- implementation implication: what likely needs to change in the code or flow

This separation matters. A good behavioral spec should still make sense to a product manager even if no code is shown.

## Naming Guidance

Use titles like:

- `[Flow Name] Behavioral Spec`
- `[Edge Case] Reconciliation Behavioral Spec`
- `[Feature] Expected Behavior Spec`
- `[Feature] Outcome and State Handling Spec`

If the note is about a race, dismissal, redirect, or cancel path, prefer `Reconciliation Behavioral Spec`.

## Output Patterns

Use these forms depending on the request:

- classification only: give the type of spec and a short explanation of why
- title request: give 2-4 strong title options and recommend one
- rewrite request: produce a clean behavioral spec in Markdown
- template request: load [references/behavioral-spec-template.md](./references/behavioral-spec-template.md) and adapt it

## Quality Checks

Before finalizing, verify:

- the trigger is clear
- each branch has an entry condition
- user-facing outcome is explicit
- stale state cleanup is named directly
- stuck states are called out
- acceptance criteria are testable

If a spec feels vague, it usually means one of these is missing: trigger, branch condition, or end-state.
