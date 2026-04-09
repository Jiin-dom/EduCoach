# Phase 3 Document Processing & Study Materials Test Plan

- Date: 2026-04-09
- Feature area: Document processing, concepts, summaries, notes, flashcards, study workspace
- Dependency map: `educoach/docs/info/dependency-maps/phase-3-document-processing-study-materials-dependency-map.md`
- Current route: `/files/:id`

## Cross-checked scope

This plan is based on:

- `src/components/files/FileViewer.tsx`
- `src/components/files/DocumentPane.tsx`
- `src/components/files/GuideTab.tsx`
- `src/components/files/ConceptsTab.tsx`
- `src/components/files/NotesTab.tsx`
- `src/components/files/FlashcardsTab.tsx`
- `src/hooks/useConcepts.ts`
- `src/hooks/useNotes.ts`
- `src/hooks/useFlashcards.ts`

## Core scenarios

### 1. Open processed document workspace

- Open a processed document at `/files/:id`.
- Expected:
  - file viewer loads
  - document content pane renders
  - study tabs are available

### 2. Guide tab summary rendering

- Open the guide/summary tab.
- Expected:
  - structured summary sections render
  - key terms and study guide content appear in readable format

### 3. Concepts tab filtering and actions

- Open the concepts tab.
- Search, sort, and filter concepts.
- Launch a quiz action from a concept.
- Expected:
  - concept cards update correctly with the filters
  - concept-driven actions work

### 4. Notes tab autosave

- Open notes for a document.
- Type new notes and pause.
- Refresh or leave and return.
- Expected:
  - autosave persists the notes
  - notes reload for the same document

### 5. Flashcards generation and review

- Open the flashcards tab.
- Generate or review flashcards for the document.
- Complete at least one review interaction.
- Expected:
  - flashcards are available
  - review interactions work
  - linked learning-progress behavior updates as expected

### 6. Reprocess document

- Trigger reprocessing for a document if that action is available.
- Expected:
  - processing state appears
  - workspace handles the transitional state cleanly
  - once complete, updated study materials appear

## Edge cases

- processed document has no concepts
- summary is partially missing
- notes save fails temporarily
- document is text-only versus PDF
- processing returns an error state
- flashcard review attempts update mastery for linked concepts but no visible crash occurs when some concept links are missing

## Validation points

- document workspace tabs do not break if some generated artifacts are missing
- PDF/text rendering remains usable
- polling/error behavior is visible during processing transitions

## Pass criteria

- The single-document study workspace works for reading, concept exploration, notes, and flashcards.
- Error and sparse-content states remain usable.
