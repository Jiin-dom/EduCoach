# Chapter I - Objectives of the Study

Source: `reference/EduCoach-Latest-11-25-12-30PM-1.pdf` (page 15)

## General Objective
This study aims to develop EduCoach, a web and mobile application designed to assist and support college students by providing personalized study plans, automated practice quiz generation, AI Study Assistant Chat, and performance analytics with timely alerts.

## Specific Objectives
1. To gather data on the challenges and difficulties encountered by students in managing study materials and study overload, preparing for examinations, and maintaining consistent study habits.
2. To determine an adaptive profiling algorithm that evaluates student performance, identifies learning strengths and weaknesses, and generates a data-driven learning path and performance analytics.
3. To identify mechanism for content extraction and quiz generation that analyzes diverse study materials and produces dynamic assessments aligned with student's learning needs.
4. To integrate an AI Study Assistant Chat that answers student questions based on the uploaded learning materials.

---

## Objective Audit

Audit date: `2026-04-11`

Audit basis:
- Objective text in this document is treated as the source of truth.
- `Docs/educoach-objectives` is incomplete in the current repository state because it only lists objectives 2 to 4.

### Features Under Each Objective

#### Objective 1
To gather data on the challenges and difficulties encountered by students in managing study materials and study overload, preparing for examinations, and maintaining consistent study habits.

Current feature coverage:
- Profiling and onboarding flows capture learner identity and study preferences:
  - display name
  - learning style
  - study goal
  - preferred subjects
  - daily study minutes
  - preferred study time window
  - available study days
- Profile and account surfaces preserve and expose those study preferences after onboarding.
- File goal dates and quiz deadlines support exam-preparation planning and study scheduling.

Key evidence:
- `educoach/src/components/forms/ProfilingForm.tsx`
- `educoach-mobile/src/screens/ProfilingScreen.tsx`
- `educoach/docs/completed/phase-2-user-profiling-and-core-data.md`

#### Objective 2
To determine an adaptive profiling algorithm that evaluates student performance, identifies learning strengths and weaknesses, and generates a data-driven learning path and performance analytics.

Current feature coverage:
- Quiz-attempt logging into per-question performance records.
- Mastery computation using weighted mastery scoring and confidence.
- SM-2 review scheduling and priority-based ranking.
- Weak-topic detection and due-topic surfacing.
- Learning Path generation and adaptive review flows.
- Dashboard summaries for readiness, weak topics, study plan, and progress insights.
- Analytics workspace for mastery, quiz history, weak topics, and trends.
- Adaptive review-quiz synchronization after learning-state changes.

Key evidence:
- `educoach/src/hooks/useLearning.ts`
- `educoach/src/lib/learningAlgorithms.ts`
- `educoach/docs/completed/phase-5-learning-intelligence-and-analytics.md`
- `educoach-mobile/docs/completed/phase-6.2-advanced-learning-intelligence.md`

#### Objective 3
To identify mechanism for content extraction and quiz generation that analyzes diverse study materials and produces dynamic assessments aligned with student's learning needs.

Current feature coverage:
- Study-material upload and library management.
- Document processing pipeline for text extraction, chunking, summaries, concept extraction, and embeddings.
- File detail study workspace with study guide, notes, flashcards, concepts, and quiz preparation.
- Quiz generation from processed materials with multiple question types and configurable difficulty.
- Review quiz generation tied to weak concepts and learning-path context.
- Quiz attempts, scoring, review, and results flows.

Key evidence:
- `educoach/docs/completed/phase-3-document-processing-pipeline.md`
- `educoach/docs/completed/phase-4-quiz-generation-and-attempts.md`
- `educoach-mobile/docs/completed/mobile-parity-phase-3.5-to-5.x.md`

#### Objective 4
To integrate an AI Study Assistant Chat that answers student questions based on the uploaded learning materials.

Current feature coverage:
- Retrieval-augmented AI tutor grounded on uploaded documents.
- Conversation persistence and message history.
- Document-scoped question asking.
- Source citations and document linking.
- Web and mobile access paths for the AI tutor.

Key evidence:
- `educoach/docs/completed/phase-6-ai-tutor-chat-rag.md`
- `educoach/src/hooks/useAiTutor.ts`
- `educoach-mobile/src/hooks/useAiTutor.ts`
- `educoach-mobile/src/screens/AiTutorChatScreen.tsx`

### Objective Audit Matrix

| Objective | Expected outcome | Implemented features | Web evidence | Mobile evidence | Status | Audit note |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Gather data on student challenges, study overload, exam preparation, and study habits | EduCoach should explicitly collect learner background, difficulties, and habit/planning inputs. | Profiling captures display name, learning style, study goal, preferred subjects, daily study minutes, preferred study time, and available study days. File exam dates and quiz deadlines support planning. | `educoach/src/components/forms/ProfilingForm.tsx`<br>`educoach/docs/completed/phase-2-user-profiling-and-core-data.md` | `educoach-mobile/src/screens/ProfilingScreen.tsx`<br>`educoach-mobile/docs/completed/mobile-parity-batch-progress.md` | Partial | EduCoach gathers useful profile and scheduling data, but there are no clearly implemented first-class fields for explicit learner pain points such as study overload, difficulty managing materials, or difficulty maintaining study habits. |
| 2. Determine an adaptive profiling algorithm that evaluates performance, identifies strengths and weaknesses, and generates a data-driven learning path and performance analytics | EduCoach should compute learning state from student performance and turn it into adaptive recommendations and analytics. | Question-attempt logging, mastery records, weighted mastery scoring, SM-2 scheduling, weak-topic detection, due-topic prioritization, adaptive review flows, dashboard insights, learning path, and analytics. | `educoach/src/hooks/useLearning.ts`<br>`educoach/src/lib/learningAlgorithms.ts`<br>`educoach/docs/completed/phase-5-learning-intelligence-and-analytics.md` | `educoach-mobile/docs/completed/mobile-parity-batch-progress.md`<br>`educoach-mobile/docs/completed/phase-6.2-advanced-learning-intelligence.md` | Complete / Strong | This is one of the strongest matches in the repository. The adaptive layer is backed by real performance data, stored mastery state, and scheduling logic rather than presentation-only UI. |
| 3. Identify mechanism for content extraction and quiz generation from diverse study materials aligned with learning needs | EduCoach should ingest study materials, extract useful learning content, and generate dynamic assessments. | File upload and library flows, document processing, chunking, concept extraction, summaries, notes, flashcards, quiz generation, review quizzes, attempts, and results. | `educoach/docs/completed/phase-3-document-processing-pipeline.md`<br>`educoach/docs/completed/phase-4-quiz-generation-and-attempts.md` | `educoach-mobile/docs/completed/mobile-parity-batch-progress.md`<br>`educoach-mobile/docs/completed/mobile-parity-phase-3.5-to-5.x.md` | Complete / Strong | The content-processing and quiz-generation objective is clearly implemented. The phrase "diverse study materials" should still be read within the current supported file and processing scope. |
| 4. Integrate an AI Study Assistant Chat that answers student questions based on uploaded learning materials | EduCoach should answer student questions using uploaded study material context. | RAG-based AI tutor, persistent conversations, document scope, source citations, and entry points from study flows. | `educoach/docs/completed/phase-6-ai-tutor-chat-rag.md`<br>`educoach/src/hooks/useAiTutor.ts` | `educoach-mobile/src/hooks/useAiTutor.ts`<br>`educoach-mobile/src/screens/AiTutorChatScreen.tsx` | Complete | The repository evidence directly supports this objective. The AI tutor is grounded on uploaded learning materials and includes source-aware output. |

### Cross-Check Summary

Overall result:
- Objective 1 is partially followed.
- Objective 2 is strongly followed.
- Objective 3 is strongly followed.
- Objective 4 is followed.
![alt text](image.png)
Audit conclusion:
- EduCoach aligns well with the study's adaptive learning, study-material processing, quiz generation, and AI tutor objectives.
- The clearest gap is Objective 1, where the system currently captures useful learner profile and scheduling preferences but does not yet appear to explicitly capture the student's concrete challenges and difficulties in the same depth stated by the objective.

Supporting implementation surfaces checked during the audit:
- Web routing and feature surfaces in `educoach/src/App.tsx`
- Mobile feature parity tracking in `educoach-mobile/docs/completed/mobile-parity-batch-progress.md`
- Phase implementation records in `educoach/docs/completed/`
- Mobile parity and learning-intelligence records in `educoach-mobile/docs/completed/`
