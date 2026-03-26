# Behavioral Spec Template

```md
# [Feature / Scenario Name] Behavioral Spec

## Purpose

This spec defines the expected behavior for [feature, flow, or edge case].

It focuses on:
- what event starts the behavior
- what the system should do next
- what the user should experience
- what outcomes are considered correct

## Trigger

The flow begins when:

- [event, action, status, or signal]

## Expected Behavior

After [trigger], the system should enter [state or short handling phase].

This phase exists to:
- [reason]
- [reason]

The system should then resolve into one of the following branches.

## Branches

### A. [Continuation or success-like branch]

Condition:
- [what causes this branch]

Expected system behavior:
- [step]
- [step]
- [step]

Expected user-facing result:
- [what the user sees]
- [what the user does not see]

### B. [Cancel, fallback, or failure branch]

Condition:
- [what causes this branch]

Expected system behavior:
- [step]
- [step]
- [step]

Expected user-facing result:
- [what the user sees]
- [what the user does not see]

## State Handling Requirements

The following state must be handled correctly:

- [state key or flag]: [set, clear, preserve, consume]
- [state key or flag]: [set, clear, preserve, consume]
- [state key or flag]: [set, clear, preserve, consume]

## Completion Criteria

The flow is complete when:

- [completion condition]
- [completion condition]
- [completion condition]

The flow is not complete if:

- [stuck loader or stale state]
- [incorrect screen or state]
- [unexpected visible error path]

## Product-Facing Result

From a product point of view:

- [outcome] should behave like "[plain-language meaning]"
- [outcome] should behave like "[plain-language meaning]"
- [bad outcome] should not happen

## Implementation Implication

The current implementation may need to change in the following way:

- [high-level implementation shift]
- [high-level implementation shift]

Important:
- [design constraint]
- [timing or state constraint]

## Acceptance Criteria

This spec is satisfied if:

1. When [trigger] occurs and [branch A condition happens], the system [expected outcome].
2. When [trigger] occurs and [branch B condition happens], the system [expected outcome].
3. The user is not left in [bad stuck state].
4. [stale state] is cleaned up correctly.
5. The final screen or state matches the intended product behavior.

## Open Questions

- [question]
- [question]
- [question]
```

## Notes

- Write the trigger before discussing implementation.
- Make branches explicit.
- Separate system behavior from user-facing result.
- Use implementation implication only after behavior is clear.
