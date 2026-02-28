## Phase 6 -- AI Tutor Chat with RAG (Completed)

This document summarizes what was implemented for Phase 6: a Retrieval-Augmented Generation (RAG) chat system that lets students ask questions and receive answers grounded in their uploaded study materials, with Bloom's Taxonomy level control and full traceability.

---

## 1. High-Level Overview

- **Goal**: Implement an AI tutor that answers student questions using only their uploaded documents as context (Objective 4 -- AI-powered tutoring with document context).
- **Mechanism**: Dense vector retrieval (RAG). The student's question is embedded, matched against pre-computed document chunk embeddings via pgvector cosine similarity, and the top matching chunks are passed to Gemini as context for a grounded answer.
- **Architecture**: Supabase Edge Function (`ai-tutor`) handles the entire RAG pipeline server-side. The React frontend sends questions via a React Query mutation and displays answers with source citations. No NLP service involvement -- RAG requires an LLM for answer generation, and embeddings must match the model used during document processing (Gemini `gemini-embedding-001` at 768 dimensions).

---

## 2. Database Schema (Migration `007_ai_tutor_chat.sql`)

Two new tables added for chat persistence and traceability:

### `chat_conversations`

Groups messages into conversations. Optionally scoped to a single document.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK -> auth.users | |
| `document_id` | UUID FK -> documents | Nullable, scopes Q&A to one document |
| `title` | TEXT | Auto-generated from first message |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Trigger-maintained |

Indexed by `(user_id, updated_at DESC)`.

### `chat_messages`

Stores every user question and AI response. The `retrieved_chunk_ids` and `similarity_scores` columns provide full traceability -- you can always look up exactly which document chunks the AI used to formulate an answer.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `conversation_id` | UUID FK -> chat_conversations | |
| `role` | TEXT | `user` or `assistant` |
| `content` | TEXT | Message text |
| `bloom_level` | TEXT | Bloom level used for this exchange |
| `retrieved_chunk_ids` | UUID[] | Which chunks were retrieved from pgvector |
| `similarity_scores` | FLOAT[] | Cosine similarity score per chunk |
| `model_used` | TEXT | e.g. `gemini-2.5-flash-lite` |
| `created_at` | TIMESTAMPTZ | |

Indexed by `(conversation_id, created_at)`.

**RLS**: Users can only view/insert their own conversations and messages. Service role has full access for the Edge Function.

---

## 3. Supabase Edge Function -- `ai-tutor`

A new Edge Function at `supabase/functions/ai-tutor/index.ts`. Follows the same patterns as existing Edge Functions (`process-document`, `generate-quiz`): CORS handling, service role key, Gemini API with retry + exponential backoff.

### 3.1. RAG Pipeline (7 steps)

1. **Auth**: Extract `user_id` from the JWT in the Authorization header.
2. **Embed question**: Call Gemini `gemini-embedding-001` with `outputDimensionality: 768` (same model used in `process-document` to embed document chunks). Truncates to 8000 chars.
3. **Vector search**: Call `match_documents()` via `supabase.rpc()` with:
   - Similarity threshold: 0.5 (lower than the default 0.7 to avoid over-filtering)
   - Max chunks: 6
   - Optional `filter_document_id` for document-scoped chat
4. **Answerability check**: If zero chunks pass the threshold, return a "not found in your materials" message and skip the LLM call entirely.
5. **Fetch context**: Join matched `chunk_id`s back to the `chunks` table for full text, and to `documents` for titles. Fetch last 4 messages from the conversation for multi-turn context.
6. **Build grounded prompt**: System prompt instructs the model to answer ONLY from the provided materials, cite sources, and adapt its explanation style to the student's selected Bloom's Taxonomy level.
7. **Generate answer**: Call `gemini-2.5-flash-lite` with temperature 0.4, max 2048 output tokens, retry logic (3 attempts, exponential backoff).

### 3.2. Bloom's Taxonomy Prompt Modifiers

The Bloom level selected by the student modifies the system prompt instruction:

| Level | Instruction |
|-------|-------------|
| Remember | Give a direct, factual answer. List key facts and definitions. |
| Understand | Explain the concept in simple terms. Use analogies if helpful. |
| Apply | Show how this concept is used in practice. Give a concrete example. |
| Analyze | Break this down into its component parts. Compare and contrast where relevant. |
| Evaluate | Discuss strengths and weaknesses. Provide a critical assessment. |
| Create | Help the student synthesize new ideas. Suggest connections between concepts. |

### 3.3. Persistence

After generating the answer, the function:
- Creates a `chat_conversations` row if this is the first message (title auto-generated from the question text).
- Inserts two `chat_messages` rows (user + assistant) with the `retrieved_chunk_ids` and `similarity_scores` for traceability.

### 3.4. Response Shape

```json
{
  "success": true,
  "answer": "Based on your notes, backpropagation is...",
  "sources": [
    {
      "documentId": "uuid",
      "documentTitle": "Deep Learning Notes",
      "chunkId": "uuid",
      "chunkPreview": "Backpropagation is an algorithm...",
      "similarity": 0.87
    }
  ],
  "conversationId": "uuid",
  "chunksUsed": 4
}
```

### 3.5. Error Handling

- User-friendly error messages with `ERROR_CODE:message` format (consistent with other Edge Functions).
- Specific codes: `AUTH_ERROR`, `CONFIG_ERROR`, `SEARCH_ERROR`, `AI_RATE_LIMIT`, `AI_SAFETY`, `AI_NETWORK`, `AI_ERROR`, `DB_ERROR`.
- Retry with exponential backoff for 429/503/500 from Gemini.

---

## 4. React Query Hook (`src/hooks/useAiTutor.ts`)

Follows the same patterns as `useDocuments.ts` and `useQuizzes.ts`: query key hierarchy, `enabled` guards, `ensureFreshSession()` before Edge Function calls, cache invalidation on success.

### Types

- `ChatConversation` -- mirrors the `chat_conversations` table
- `ChatMessage` -- mirrors the `chat_messages` table
- `SourceCitation` -- source info returned by the Edge Function
- `SendMessageInput` -- mutation input (message, bloomLevel, conversationId?, documentId?)
- `SendMessageResponse` -- mutation output (answer, sources, conversationId, chunksUsed)

### Query Keys

```typescript
chatKeys = {
    all: ['chat'],
    conversations: () => ['chat', 'conversations'],
    conversation: (id) => ['chat', 'conversation', id],
    messages: (conversationId) => ['chat', 'messages', conversationId],
}
```

### Queries

- `useConversations()` -- list all conversations for the current user, ordered by most recent
- `useConversationMessages(conversationId)` -- fetch messages for a conversation, ordered chronologically

### Mutations

- `useSendMessage()` -- invoke the `ai-tutor` Edge Function. Pre-flight: `ensureFreshSession()`. On success: invalidates conversations and messages cache.
- `useDeleteConversation()` -- delete a conversation (cascades to messages via FK). On success: invalidates all chat cache.

---

## 5. Frontend UI -- AiTutorChat.tsx

The existing floating chat widget at `src/components/shared/AiTutorChat.tsx` was completely rewritten from mock data to a fully functional RAG chat interface.

### 5.1. What Changed

| Before (Mock) | After (RAG) |
|----------------|-------------|
| Hardcoded messages array | Real messages from `useSendMessage()` mutation |
| `setTimeout` fake response | Calls `ai-tutor` Edge Function via React Query |
| No backend connection | Full Supabase integration |
| Static avatar "JD" | "You" avatar for user messages |
| No loading state | Spinner + "Thinking..." indicator while AI responds |
| No error handling | Error bar with message, auto-clears on next send |
| No source citations | Clickable source links with document title + similarity % |
| No document scoping | "Search In" dropdown to filter to a specific document |
| No conversation management | "New conversation" button in header |

### 5.2. Props

```typescript
interface AiTutorChatProps {
    documentId?: string  // Optional: scope chat to this document
}
```

- When `documentId` is provided (e.g. from FileViewer), the chat is scoped to that document and the document selector is hidden.
- When omitted (e.g. from Dashboard), the user sees a "Search In" dropdown to choose a specific document or "All Documents".

### 5.3. Message Flow

1. User types a question and presses Enter (or clicks Send).
2. User message is immediately shown in the chat (optimistic UI).
3. A "Thinking..." loading indicator appears.
4. `useSendMessage.mutateAsync()` calls the Edge Function.
5. On success: loading indicator is replaced with the AI answer + source citations.
6. On error: loading indicator is removed, error message appears at the bottom.

### 5.4. Source Citations

Each AI response can include source citations rendered as clickable links:
- Document title (truncated)
- Similarity percentage (e.g. "87%")
- Links to `/files/:documentId` so the student can view the source material

### 5.5. Controls

- **Bloom's Taxonomy selector**: 6 levels (Remember, Understand, Apply, Analyze, Evaluate, Create). Changes how the AI explains, not what it retrieves.
- **Document scope selector**: "All Documents" or a specific ready document. Only shown when no `documentId` prop is provided.
- **New conversation button**: Resets the conversation state to start fresh.

---

## 6. Integration Points

### FileViewer (`src/components/files/FileViewer.tsx`)

Changed from:
```
<AiTutorChat />
```
To:
```
<AiTutorChat documentId={id} />
```

When a student opens the chat from a file detail page, questions are answered specifically from that document's content.

### DashboardContent (`src/components/dashboard/DashboardContent.tsx`)

Unchanged -- `<AiTutorChat />` with no prop. The chat searches across all user documents.

---

## 7. Prerequisites / Dependencies

The RAG pipeline depends on infrastructure from earlier phases:

| Dependency | From Phase | Used By |
|------------|-----------|---------|
| `document_embeddings` table + pgvector | Phase 3 (`002_document_processing.sql`) | Vector similarity search |
| `match_documents()` function | Phase 3 (`002_document_processing.sql`) | `supabase.rpc('match_documents')` in Edge Function |
| `chunks` table with document text | Phase 3 (`process-document` Edge Function) | Full chunk content for context |
| `documents` table | Phase 1 (`001_initial_schema.sql`) | Document titles for citations |
| Gemini `gemini-embedding-001` embeddings (768d) | Phase 3 (`process-document` Edge Function) | Question embedding must use the same model |
| Gemini `gemini-2.5-flash-lite` | Phase 3/4 | Answer generation |

---

## 8. Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/007_ai_tutor_chat.sql` | 2 new tables (conversations + messages) |
| `supabase/functions/ai-tutor/index.ts` | RAG Edge Function (embed, search, generate, persist) |
| `src/hooks/useAiTutor.ts` | React Query hooks for chat |

## 9. Files Modified

| File | Change |
|------|--------|
| `src/components/shared/AiTutorChat.tsx` | Full rewrite: mock data replaced with real RAG backend |
| `src/components/files/FileViewer.tsx` | Pass `documentId` prop to AiTutorChat |

---

## 10. How to Deploy Phase 6

1. **Apply the database migration**: In Supabase SQL Editor, run `supabase/migrations/007_ai_tutor_chat.sql`
2. **Deploy the Edge Function**: `supabase functions deploy ai-tutor` (ensure `GEMINI_API_KEY` is set in Supabase project secrets)
3. **Rebuild the frontend**: The new TypeScript files and modified components will be included automatically

---

## 11. Verification Checklist

- Ensure at least one document is uploaded, processed, and has embeddings (Phase 3 prerequisite)
- Open the Dashboard and click the chat bubble (bottom-right)
- Ask a question about the document content
- Verify:
  - "Thinking..." spinner appears while waiting
  - AI response appears with content from the uploaded materials
  - Source citations appear below the response with document title and similarity %
  - Clicking a source link navigates to the file detail page
- Try asking something NOT in the documents
  - Verify: "I couldn't find relevant information" message appears
- Change the Bloom level to "Remember" and ask the same question
  - Verify: response style changes (more factual, list-based)
- Navigate to a file detail page and open the chat
  - Verify: chat is scoped to that document (no document selector shown)
  - Ask about content from a different document -- should get "not found" response
- Use the "Search In" dropdown on the Dashboard chat to scope to a specific document
- Click the "New conversation" button (rotate icon) to start fresh
- Check the database:
  - `chat_conversations` row exists with correct `user_id` and `title`
  - `chat_messages` rows exist with `role`, `content`, `bloom_level`, `retrieved_chunk_ids`, `similarity_scores`, and `model_used`
