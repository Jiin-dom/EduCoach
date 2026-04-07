# EduCoach Overview

This document gives a high-level view of the EduCoach product, its purpose, and the core learning loop the application is trying to build.

## What is EduCoach?

EduCoach is an **AI-powered personalized learning platform**. Its goal is to help students study more effectively by turning raw study materials into structured, adaptive study work.

Here is what the platform is trying to do:
- **Upload Study Materials:** Students upload PDFs, Word documents, text files, and markdown files.
- **AI Extraction:** The system reads those files, creates summaries, extracts core concepts, and stores searchable representations of the material.
- **Active Recall Generation:** EduCoach generates quizzes and flashcards directly from uploaded materials so students can practice instead of only rereading notes.
- **Adaptive Learning Intelligence:** EduCoach tracks how well the student performs on concepts, identifies strengths and weak areas, and estimates what the student should focus on next.
- **Personalized Learning Path:** EduCoach should turn weak, overdue, or still-developing concepts into scheduled study work, including targeted quizzes, flashcards, and review sessions.
- **Continuous Replanning:** As the student completes those activities, the system should keep updating mastery and regenerating the next best study tasks.

## The Technology Stack

### Frontend
- **React 18 and Vite:** Fast user interface and development workflow.
- **TypeScript:** Safer application code and better maintainability.
- **Tailwind CSS and shadcn/ui:** Reusable UI components and styling.
- **TanStack Query:** Data fetching, caching, and async state management.

### Backend
- **Supabase:** Backend-as-a-Service for database, authentication, and storage.
- **PostgreSQL:** Relational data storage.
- **Supabase Storage:** Uploaded document storage.
- **Supabase Edge Functions:** Server-side document processing, quiz generation, and AI tutor orchestration.

### AI and Machine Learning
- **Google Gemini API (`gemini-2.5-flash-lite`):** Summary generation, concept extraction, and grounded responses.
- **Embeddings:** Vector embeddings for semantic search over uploaded materials.
- **pgvector:** Vector similarity search inside PostgreSQL.

## How It All Connects

When a student uses EduCoach, the intended system loop looks like this:

1. **Onboarding:** The student signs up, logs in, and completes profiling such as learning preferences, goals, and study availability.
2. **Uploading:** The student uploads study files, which are stored in Supabase Storage.
3. **Processing:** EduCoach processes the file, extracts text, chunks content, generates summaries, identifies concepts, and stores embeddings.
4. **Study Generation:** The app uses those processed materials to generate quizzes, flashcards, and document-grounded study interactions.
5. **Performance Tracking:** When the student answers quizzes or completes flashcard reviews, EduCoach records performance at the concept level.
6. **Learning Intelligence:** The system updates mastery, confidence, strengths, weaknesses, readiness, and review timing.
7. **Adaptive Planning:** EduCoach should automatically generate targeted quizzes, flashcards, and review sessions for weak or developing concepts, place them on the learning path, and keep refreshing that plan as new data arrives.

## Current Project Direction

EduCoach should be understood as more than a file processor or quiz generator. The real product direction is a closed learning loop:

`materials -> generated study activities -> student performance -> mastery updates -> new targeted study activities`

That means the learning path is not just a passive calendar. It is supposed to become the orchestration layer that decides what the student should study next, generates the right study tasks for those weak areas, and keeps adjusting as the student improves.
