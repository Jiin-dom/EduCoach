# EduCoach architecture notes

Two tracks live in this folder:

- **Beginner guides** — plain language, expanded workflows, glossaries, diagrams (start here if you are new).
- **Architecture (technical)** — shorter, code-anchored references for implementation detail.

## Beginner guides

| Document | Topic |
|----------|--------|
| [beginners-guide-content-extraction.md](./beginners-guide-content-extraction.md) | Upload → processing → chunks, concepts, embeddings |
| [beginners-guide-quiz-generation.md](./beginners-guide-quiz-generation.md) | How quizzes are built, adaptive mastery, NLP vs Gemini fallback |
| [beginners-guide-learning-path.md](./beginners-guide-learning-path.md) | WMS, SM-2, calendar plan, adaptive review quizzes |
| [beginners-guide-learning-path-calculations.md](./beginners-guide-learning-path-calculations.md) | Step-by-step formulas and examples for WMS, SM-2, priority, and decay |
| [beginners-guide-ai-chat.md](./beginners-guide-ai-chat.md) | RAG tutor: embeddings, search your notes, grounded answers |
| [beginners-guide-analytics.md](./beginners-guide-analytics.md) | Charts, weak topics, trends, display decay |

## Technical architecture

| Document | Topic |
|----------|--------|
| [architecture-content-extraction.md](./architecture-content-extraction.md) | Upload → NLP (Tika, spaCy, TextRank, KeyBERT) → chunks, concepts, embeddings |
| [architecture-quiz-generation.md](./architecture-quiz-generation.md) | `generate-quiz` → NLP `/generate-questions`, mastery-aware AQG, Gemini fallback |
| [architecture-learning-path.md](./architecture-learning-path.md) | WMS, SM-2, plan builder, adaptive tasks, review quiz triggers |
| [architecture-ai-chat.md](./architecture-ai-chat.md) | RAG: Gemini embeddings + `match_documents_for_user` + Gemini chat |
| [architecture-analytics.md](./architecture-analytics.md) | Dashboards over mastery, trends, activity; display decay |
