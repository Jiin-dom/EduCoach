# Phase 6 AI Tutor RAG Test Plan

- Date: 2026-04-09
- Feature area: AI tutor, chat history, document-scoped tutoring, citations
- Dependency map: `educoach/docs/info/dependency-maps/phase-6-ai-tutor-rag-dependency-map.md`
- Current entry points: dashboard AI tutor launcher, file-detail AI tutor launcher

## Cross-checked scope

This plan is based on:

- `src/components/shared/AiTutorChat.tsx`
- `src/hooks/useAiTutor.ts`
- `src/components/dashboard/DashboardContent.tsx`
- `src/components/files/FileViewer.tsx`

## Core scenarios

### 1. Open tutor from dashboard

- Launch the AI tutor from the dashboard.
- Expected:
  - chat drawer opens
  - conversation list loads
  - user can start a new conversation

### 2. Open tutor from file detail

- Open a processed document at `/files/:id`.
- Launch AI tutor from the document workspace.
- Expected:
  - tutor opens scoped to the document
  - responses can use document-specific context

### 3. Send a message

- Ask a tutor question.
- Expected:
  - user message appears in history
  - assistant response returns
  - citations or source references render when provided

### 4. Conversation history

- Start multiple conversations.
- Switch between them.
- Expected:
  - message history persists per conversation
  - switching does not merge messages incorrectly

### 5. Delete conversation

- Delete a conversation.
- Expected:
  - it disappears from the conversation list
  - deleted history is no longer shown

## Edge cases

- tutor used against a document with missing embeddings
- empty conversation state
- send-message failure from the edge function
- user opens tutor with no uploaded documents
- non-premium or quota-limited behavior if enforced by current backend rules

## Validation points

- dashboard and file-detail entry points both use the same chat component cleanly
- document scoping changes the context without breaking conversation history
- citation rendering does not crash when a response has no citations

## Pass criteria

- AI tutor works from both entry points.
- Conversations persist, can be deleted, and recover cleanly from message-send failures.
