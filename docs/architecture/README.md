# EduCoach architecture notes

Short, code-anchored descriptions of major product areas. Each file is standalone for slides or deep dives.

| Document | Topic |
|----------|--------|
| [architecture-content-extraction.md](./architecture-content-extraction.md) | Upload → NLP (Tika, spaCy, TextRank, KeyBERT) → chunks, concepts, embeddings |
| [architecture-quiz-generation.md](./architecture-quiz-generation.md) | `generate-quiz` → NLP `/generate-questions`, mastery-aware AQG, Gemini fallback |
| [architecture-learning-path.md](./architecture-learning-path.md) | WMS, SM-2, plan builder, adaptive tasks, review quiz triggers |
| [architecture-ai-chat.md](./architecture-ai-chat.md) | RAG: Gemini embeddings + `match_documents_for_user` + Gemini chat |
| [architecture-analytics.md](./architecture-analytics.md) | Dashboards over mastery, trends, activity; display decay |
