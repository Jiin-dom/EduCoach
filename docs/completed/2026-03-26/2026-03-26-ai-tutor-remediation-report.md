# AI Tutor Remediation Completion Report

**Date Completed:** 2026-03-26  
**Follow-up To:** [Phase 6 -- AI Tutor Chat with RAG](./phase-6-ai-tutor-chat-rag.md)

## Overview
This report documents the remediation pass for Phase 6 AI Tutor Chat across Edge Function, web, and mobile. The focus was security hardening, removal of manual Bloom-level controls, automatic explanation-level inference by the tutor, citation persistence/replay, and response formatting cleanup.

## Root Causes Identified
1. Token auth in the Edge Function decoded JWT payload without verification.
2. Vector retrieval path was not user-scoped at SQL level when called via service role.
3. Existing `conversationId` ownership was not validated before history read/write.
4. Conversation ordering by `updated_at` could become stale after new messages.
5. Source citations were returned at response-time but not persisted for reliable history replay.
6. Bloom-level UI forced manual level selection, contrary to new instruction to let tutor infer level.
7. Tutor outputs could contain markdown emphasis artifacts like `**` in the chat UI.

## What Was Fixed

### 1) Database / SQL
- Added migration: `supabase/migrations/016_ai_tutor_remediation.sql`
- Added `chat_messages.source_citations JSONB NOT NULL DEFAULT '[]'::jsonb`.
- Added trigger `touch_chat_conv_on_message_insert` to keep `chat_conversations.updated_at` fresh on each message insert.
- Added user-scoped retrieval function `match_documents_for_user(...)` that joins `documents` and filters by `user_id` at query level.
- Added citation backfill query for historical assistant rows using existing `retrieved_chunk_ids` + `similarity_scores`.

### 2) Edge Function (`supabase/functions/ai-tutor/index.ts`)
- Replaced manual JWT decode with verified auth using `supabase.auth.getUser(token)`.
- Added document ownership validation for scoped chat requests.
- Added conversation ownership validation for existing conversation history access.
- Switched retrieval call to `match_documents_for_user` with `p_user_id`.
- Removed Bloom prompt modifier logic and moved to hidden automatic pedagogy inference.
- Updated system prompt to require plain-text output (no markdown syntax).
- Added `sanitizeAiResponse()` to strip markdown artifacts (`**`, `__`, backticks, headings) and normalize spacing.
- Persisted `source_citations` in assistant `chat_messages` rows.

### 3) Web Chat (`src/components/shared/AiTutorChat.tsx`, `src/hooks/useAiTutor.ts`)
- Removed Learning Level (Bloom) selector UI and related client-side state.
- Updated send-message contract to stop sending `bloomLevel`.
- Added history citation rendering using persisted `source_citations`.
- Added assistant text cleanup for legacy markdown artifacts in stored/new messages.
- Improved message readability with better wrapping and spacing.

### 4) Mobile Chat (`educoach-mobile/src/screens/AiTutorChatScreen.tsx`, `educoach-mobile/src/hooks/useAiTutor.ts`)
- Removed Bloom chips/state and stopped sending `bloomLevel`.
- Added history citation rendering from persisted `source_citations`.
- Added assistant text cleanup for markdown artifacts.
- Preserved document scope picker and conversation history behavior.

## Deployment Sequence
1. Apply DB migration `016_ai_tutor_remediation.sql`.
2. Redeploy Supabase Edge Function `ai-tutor`.
3. Deploy web app updates.
4. Deploy mobile app updates.

## Verification Results

### Automated commands requested
- `cd educoach && npm run lint` -> **Could not run in this environment** (`node`/`npm` unavailable in WSL sandbox).
- `cd educoach && npm test` -> **Could not run in this environment** (`node`/`npm` unavailable).
- `cd educoach && npm run build` -> **Could not run in this environment** (`node`/`npm` unavailable).
- `cd educoach-mobile && npx tsc --noEmit` -> **Could not run in this environment** (`node`/`npm` unavailable).

### Functional/security checks implemented in code
- Verified token authentication now uses server-side `getUser` verification.
- Verified retrieval call path now requires user-scoped SQL function.
- Verified conversation/document ownership checks are enforced before history and scope usage.
- Verified Bloom selector references removed from web and mobile AI Tutor UI.
- Verified citations are now persisted and mapped back into history rendering in web/mobile.
- Verified response sanitization removes visible markdown emphasis artifacts.

## Backward Compatibility Notes
- `bloomLevel` is now optional/ignored by Edge for compatibility with older clients.
- `chat_messages.bloom_level` column remains for schema compatibility; new writes set `NULL`.
- Existing chat flows and response shape (`answer`, `sources`, `conversationId`, `chunksUsed`) remain unchanged.

## Residual Non-Blocking Items
- Full automated verification should be executed in a Node-enabled CI/dev environment after merge to confirm lint/test/build/typecheck end-to-end.
