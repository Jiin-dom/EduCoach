# Phase 6 AI Tutor RAG Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/phase-6-ai-tutor-chat-rag.md`
- `educoach/docs/completed/2026-03-26-ai-tutor-remediation-report.md`
- `educoach/docs/info/embedding-model-migration.md`

**Primary current entry points**
- `src/components/dashboard/DashboardContent.tsx`
- `src/components/files/FileViewer.tsx`
- `src/components/shared/AiTutorChat.tsx`

## Current Dependency Flow

```text
DashboardContent.tsx / FileViewer.tsx
  -> shared/AiTutorChat.tsx
      -> hooks/useAiTutor.ts
          -> useConversations()
          -> useConversationMessages()
          -> useSendMessage()
          -> useDeleteConversation()
      -> hooks/useDocuments.ts
      -> supabase.functions.invoke("ai-tutor")
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/components/shared/AiTutorChat.tsx` | Shared chat drawer, conversation history, document scoping, message rendering, citation display | `useAiTutor`, `useDocuments`, routing links |
| `src/hooks/useAiTutor.ts` | Conversation/message queries and message-send/delete mutations | `supabase`, `ensureFreshSession`, `useAuth` |
| `src/components/dashboard/DashboardContent.tsx` | Global AI tutor launcher on dashboard | `AiTutorChat` |
| `src/components/files/FileViewer.tsx` | Document-scoped AI tutor entry point | `AiTutorChat` with `documentId` |

## Supabase / Backend Touchpoints

- `public.chat_conversations`
- `public.chat_messages`
- `public.document_embeddings`
- `public.chunks`
- `public.documents`
- `public.match_documents()` RPC
- `supabase/functions/ai-tutor`

## Notes

- The embedding-model migration did not change the frontend component tree; it changed the backend contract that `AiTutorChat` depends on for retrieval quality.
- Subscription limits and notification side-effects are cross-cutting dependencies from other maps, not separate chat UI owners.
