# Performance-Driven Learning Path

## Overview
The Learning Path in EduCoach serves as the core intelligence of the system. It is responsible for generating and scheduling study tasks such as quizzes, flashcards, and review sessions based on the student’s performance data, identified strengths and weaknesses, available study schedule, and target study goal or deadline.

The system operates through two primary functions:
- **Task Generation (WHAT to study)**
- **Task Scheduling (WHEN to study)**

---

## Initial Phase (No Data Yet)
When a student uploads study material and no prior performance data exists, the system generates a **baseline set of tasks**.

- Tasks are evenly distributed across all topics
- Purpose: establish initial knowledge level
- Tasks include:
  - Quizzes
  - Flashcards
  - Review sessions

These tasks are then scheduled based on:
- Student’s available study days
- Study time preferences
- Goal or deadline date

---

## Data Collection Phase
As the student interacts with the system, EduCoach collects **performance data** through:
- Quiz attempts
- Flashcard interactions
- Review sessions

Performance is tracked at the **topic level**, meaning each topic is evaluated independently.

Example:
- Solar System → 80%
- Human Body → 65%
- Energy → 40% (weak)

---

## Incremental Mastery
The system does NOT assume mastery after a single correct attempt.

Instead, mastery is developed **gradually** based on:
- Repeated attempts
- Consistency of correct answers
- Recency of performance

This ensures:
- Accurate evaluation of knowledge
- Avoidance of overestimating student ability

---

## Adaptive Task Generation
Based on collected data:
- Weak topics are prioritized
- Strong topics are still included

Example:
If "Energy" is weak:
- More quizzes and tasks on Energy
- Fewer tasks on stronger topics

However:
- Strong topics are reinforced using **spaced repetition**

---

## Spaced Repetition Strategy
The system ensures long-term retention by:
- Reviewing weak topics more frequently
- Reviewing strong topics less frequently but consistently

This prevents:
- Forgetting previously learned material
- Over-focusing on only weak areas

---

## Adaptive Scheduling (Deadline-Aware)
Task scheduling adjusts based on time remaining before the goal date.

### If deadline is far:
- Tasks are spaced out
- Focus on long-term retention

### If deadline is near:
- Tasks are compressed
- Increased review frequency
- Focus on rapid reinforcement

---

## Integration of Manual Tasks
EduCoach also considers:
- Manually generated quizzes
- User-created flashcards

All interactions contribute to:
- Performance tracking
- Learning path adaptation

---

## Feedback Loop (Core Mechanism)
The Learning Path operates as a continuous cycle:

1. Student completes task
2. System analyzes performance
3. Mastery levels are updated
4. Weak topics are identified
5. New tasks are generated
6. Tasks are rescheduled

This loop ensures:
- Continuous adaptation
- Personalized learning experience

---

## Goal of the Learning Path
The primary goal is to:
- Improve student preparedness
- Increase topic mastery
- Align study efforts with actual weaknesses
- Support achievement of academic goals (e.g., exams)

---

## Summary
EduCoach transforms studying into a:
- Structured
- Data-driven
- Adaptive

learning experience by continuously adjusting tasks and schedules based on real-time student performance.