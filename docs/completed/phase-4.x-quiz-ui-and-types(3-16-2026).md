## Phase 4.x – Quiz UI & Question Type Controls

### 1. Quiz Generation Modal Enhancements

- **File**: `src/components/files/GenerateQuizDialog.tsx`
- **Goal**: Let users configure quizzes per document with:
  - Number of questions (`QUESTION_COUNT_OPTIONS` = 5, 10, 15, 20)
  - Difficulty mix (`mixed | easy | medium | hard`)
  - **Question types** (Identification, Multiple Choice, True/False, Fill in the Blank)

**Key details:**
- Uses `useGenerateQuiz()` from `src/hooks/useQuizzes.ts`.
- Local state:
  - `difficulty: 'mixed' | 'easy' | 'medium' | 'hard'`
  - `questionCount: number`
  - `selectedTypes: QuizTypeId[]` (defaults to all types)
  - `typeError: string | null` to enforce “at least one type” selection.
- On modal close, all state resets to defaults so each generation starts fresh.
- On submit:
  - Validates `selectedTypes.length > 0`.
  - Calls `generateQuiz.mutate({ documentId, questionCount, difficulty, questionTypes: selectedTypes, enhanceWithLlm: true })`.
  - Shows a “generating” phase with rotating status messages and disables closing.

### 2. Quiz Type Model and Backend Wiring

- **File**: `src/types/quiz.ts`

```10:10:src/types/quiz.ts
export type QuizTypeId = 'identification' | 'multiple_choice' | 'true_false' | 'fill_in_blank'

export const ALL_QUIZ_TYPES: QuizTypeId[] = [
    'identification',
    'multiple_choice',
    'true_false',
    'fill_in_blank',
]
```

- The modal **UI labels** map to these internal type ids:
  - `identification` → “Identification”
  - `multiple_choice` → “Multiple Choice”
  - `true_false` → “True or False”
  - `fill_in_blank` → “Fill in the Blank” (this is the “short answer” style in UX, but matches the backend’s `fill_in_blank` value).

- **File**: `src/hooks/useQuizzes.ts`
  - `GenerateQuizInput` now has `questionTypes?: QuizTypeId[]`.
  - `useGenerateQuiz` passes types through to the `generate-quiz` edge function:

```276:285:src/hooks/useQuizzes.ts
const { data, error } = await supabase.functions.invoke('generate-quiz', {
    body: {
        documentId: input.documentId,
        questionCount: input.questionCount ?? 10,
        difficulty: input.difficulty ?? 'mixed',
        questionTypes: input.questionTypes && input.questionTypes.length > 0
            ? input.questionTypes
            : ALL_QUIZ_TYPES,
        enhanceWithLlm: input.enhanceWithLlm ?? true,
        userId: session.user.id,
    },
})
```

- **Edge Function**: `supabase/functions/generate-quiz/index.ts`
  - Accepts `questionTypes?: string[]` in `GenerateQuizRequest`.
  - Forwards `questionTypes` to:
    - NLP service `/generate-questions` as `question_types`.
    - Gemini fallback `generateWithGemini` to constrain LLM-generated question types.
  - This keeps the backend honoring exactly the types selected in the UI, while existing defaults still generate a full mix when no types are specified.

### 3. Files Page – Unified Quiz Generation Entry Point

- **File**: `src/components/files/FilesContent.tsx`
- **Problem**: The “Generate quiz from this file” icon on the Files list previously:
  - Called `useGenerateQuiz` directly with fixed params.
  - Skipped the modal (no type selection or difficulty options).
- **Change**:
  - Introduced state:
    - `quizDialogOpen: boolean`
    - `selectedDocForQuiz: Document | null`
  - Updated the ready-file Sparkles icon to **open the same `GenerateQuizDialog`** used in `StudyHeader`:

```213:225:src/components/files/FilesContent.tsx
const handleGenerateQuiz = (doc: Document) => {
    setSelectedDocForQuiz(doc)
    setQuizDialogOpen(true)
}
...
{file.status === 'ready' && (
    <Button
        variant="ghost"
        size="icon"
        className="text-primary hover:text-primary"
        onClick={() => handleGenerateQuiz(file)}
    >
        <Sparkles className="w-4 h-4" />
    </Button>
)}
...
{selectedDocForQuiz && (
    <GenerateQuizDialog
        open={quizDialogOpen}
        onOpenChange={(open) => {
            setQuizDialogOpen(open)
            if (!open) {
                setSelectedDocForQuiz(null)
            }
        }}
        documentId={selectedDocForQuiz.id}
    />
)}
```

- **Result**: Both Files list and File Detail view route through a single configuration modal and share the same behavior and validation.

### 4. Post-Generation Navigation & Highlighting

- **Requirement**: After generating a quiz, do **not** jump straight into the session; instead, go to the Quizzes overview and highlight the new quiz.

- **GenerateQuizDialog navigation**:

```81:87:src/components/files/GenerateQuizDialog.tsx
onSuccess: (data) => {
    setPhase('success')
    setTimeout(() => {
        handleOpenChange(false)
        navigate('/quizzes', {
            state: data?.quizId ? { highlightQuizId: data.quizId } : undefined,
        })
    }, 1500)
}
```

- **Quizzes page**: `src/components/quizzes/QuizzesContent.tsx`
  - Reads `highlightQuizId` from router `location.state`.
  - Stores it in local state and then clears navigation state (so refreshes don’t re-highlight).
  - Wraps each Available quiz in a div that adds a ring around the newly created quiz:

```13:27:src/components/quizzes/QuizzesContent.tsx
const location = useLocation()
const navigate = useNavigate()
const [highlightQuizId, setHighlightQuizId] = useState<string | null>(() => {
    const state = location.state as { highlightQuizId?: string } | null
    return state?.highlightQuizId ?? null
})

useEffect(() => {
    const state = location.state as { highlightQuizId?: string } | null
    if (state?.highlightQuizId && !highlightQuizId) {
        setHighlightQuizId(state.highlightQuizId)
        navigate(location.pathname, { replace: true })
    }
}, [location, navigate, highlightQuizId])
```

```157:165:src/components/quizzes/QuizzesContent.tsx
<div className="space-y-3">
    {availableQuizzes.map((quiz) => (
        <div
            key={quiz.id}
            className={quiz.id === highlightQuizId
                ? "ring-2 ring-primary rounded-lg"
                : ""}
        >
            <QuizCard
                quiz={quiz}
                lastScore={lastScoreByQuiz.get(quiz.id) ?? null}
            />
        </div>
    ))}
</div>
```

- **UX**: After generation finishes, users land on `/quizzes` with the new quiz visually emphasized in the “Available” tab.

### 5. Delete Quiz Flow

- **Hook**: `useDeleteQuiz` in `src/hooks/useQuizzes.ts`
  - Deletes the quiz row from the `quizzes` table and invalidates quiz queries:

```414:429:src/hooks/useQuizzes.ts
export function useDeleteQuiz() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (quizId: string) => {
            const { error } = await supabase
                .from('quizzes')
                .delete()
                .eq('id', quizId)

            if (error) throw new Error(error.message)
            return quizId
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: quizKeys.all })
        },
    })
}
```

- **UI**: `QuizCard` in `src/components/dashboard/QuizCard.tsx`
  - Imports `useDeleteQuiz` and adds a Delete button under the Start/Retake button:

```12:26:src/components/dashboard/QuizCard.tsx
import { Clock, FileQuestion, CheckCircle2, Loader2, AlertCircle, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useDeleteQuiz, type Quiz } from "@/hooks/useQuizzes"

export function QuizCard({ quiz, lastScore }: QuizCardProps) {
    const deleteQuiz = useDeleteQuiz()
    ...
    const isDeleting = deleteQuiz.isPending
```

```89:103:src/components/dashboard/QuizCard.tsx
<div className="shrink-0 w-full sm:w-auto flex flex-col items-stretch gap-2">
    {isReady && (
        <Link to={`/quizzes/${quiz.id}`} className="w-full">
            <Button size="sm" variant={hasAttempt ? "outline" : "default"} className="w-full sm:w-auto">
                {hasAttempt ? "Retake" : "Start Quiz"}
            </Button>
        </Link>
    )}
    {isGenerating && (
        <Button size="sm" variant="outline" disabled className="w-full sm:w-auto">
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            Generating...
        </Button>
    )}

    <Button
        size="sm"
        variant="outline"
        className="w-full sm:w-auto gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        disabled={isGenerating || isDeleting}
        onClick={() => {
            const ok = window.confirm(`Delete quiz "${quiz.title}"? This cannot be undone.`)
            if (!ok) return
            deleteQuiz.mutate(quiz.id)
        }}
    >
        {isDeleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
            <Trash2 className="w-3 h-3" />
        )}
        Delete
    </Button>
</div>
```

- **Effect**: Quiz deletion is reflected in the UI via React Query refetch; the actual cascade behavior for `quiz_questions` and `attempts` is handled at the DB schema level (FKs with `ON DELETE CASCADE` in the migrations).

---

This document should give other developers a clear view of how quiz configuration, routing, and deletion currently work in the EduCoach frontend and how they connect to the existing Phase 4 quiz generation pipeline.

