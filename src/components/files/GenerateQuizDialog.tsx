import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Brain } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGenerateQuiz } from '@/hooks/useQuizzes'
import { Checkbox } from '@/components/ui/checkbox'
import { ALL_QUIZ_TYPES, type QuizTypeId } from '@/types/quiz'
import { computeBalancedQuizTypeTargets, formatQuizTypeTargetsForHumans } from '@/lib/quizAllocation'

interface GenerateQuizDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    documentId: string
}

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const

const GENERATING_MESSAGES = [
    'Analyzing document concepts…',
    'Crafting questions from key topics…',
    'Building answer choices…',
    'Applying difficulty settings…',
    'Validating question quality…',
    'Almost there, finalizing your quiz…',
]

type Phase = 'idle' | 'generating' | 'success' | 'error'

export function GenerateQuizDialog({ open, onOpenChange, documentId }: GenerateQuizDialogProps) {
    const navigate = useNavigate()
    const generateQuiz = useGenerateQuiz()
    const [difficulty, setDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed')
    const [questionCount, setQuestionCount] = useState<number>(10)
    const [selectedTypes, setSelectedTypes] = useState<QuizTypeId[]>(ALL_QUIZ_TYPES)
    const [typeError, setTypeError] = useState<string | null>(null)
    const [phase, setPhase] = useState<Phase>('idle')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [rotatingMsg, setRotatingMsg] = useState('')
    const rotatingIndex = useRef(0)

    const isBusy = phase === 'generating'

    const { stableSelectedTypes, targetsByType } = computeBalancedQuizTypeTargets({
        totalCount: questionCount,
        selectedTypes,
    })
    const breakdownText = formatQuizTypeTargetsForHumans({ stableSelectedTypes, targetsByType })

    useEffect(() => {
        if (!isBusy) return
        const interval = setInterval(() => {
            rotatingIndex.current = (rotatingIndex.current + 1) % GENERATING_MESSAGES.length
            setRotatingMsg(GENERATING_MESSAGES[rotatingIndex.current])
        }, 4000)
        return () => clearInterval(interval)
    }, [isBusy])

    const handleOpenChange = (newOpen: boolean) => {
        if (isBusy) return
        if (!newOpen) {
            setTimeout(() => {
                setPhase('idle')
                setErrorMessage(null)
                setDifficulty('mixed')
                setQuestionCount(10)
                setSelectedTypes(ALL_QUIZ_TYPES)
                setTypeError(null)
            }, 200)
        }
        onOpenChange(newOpen)
    }

    const handleGenerate = () => {
        if (selectedTypes.length === 0) {
            setTypeError('Select at least one question type.')
            return
        }

        setPhase('generating')
        setErrorMessage(null)
        setTypeError(null)
        rotatingIndex.current = 0
        setRotatingMsg(GENERATING_MESSAGES[0])
        generateQuiz.mutate(
            {
                documentId,
                questionCount,
                difficulty,
                questionTypes: selectedTypes,
                questionTypeTargets: targetsByType,
                enhanceWithLlm: true,
            },
            {
                onSuccess: (data) => {
                    setPhase('success')
                    setTimeout(() => {
                        handleOpenChange(false)
                        navigate('/quizzes', {
                            state: data?.quizId ? { highlightQuizId: data.quizId } : undefined,
                        })
                    }, 1500)
                },
                onError: (err) => {
                    setPhase('error')
                    setErrorMessage(err instanceof Error ? err.message : 'Failed to generate quiz.')
                },
            }
        )
    }

    return (
        <>
            {isBusy && (
                <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" />
            )}

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent
                    className={`sm:max-w-md ${isBusy || phase === 'success' ? 'z-[70]' : ''}`}
                    onPointerDownOutside={(e) => { if (isBusy) e.preventDefault() }}
                    onEscapeKeyDown={(e) => { if (isBusy) e.preventDefault() }}
                    onInteractOutside={(e) => { if (isBusy) e.preventDefault() }}
                >
                    {isBusy && (
                        <style>{`[data-dialog-close] { display: none !important; }`}</style>
                    )}

                    <DialogHeader>
                        <DialogTitle>
                            {isBusy
                                ? 'Generating Your Quiz'
                                : phase === 'success'
                                    ? 'Quiz Ready!'
                                    : phase === 'error'
                                        ? 'Generation Failed'
                                        : 'Generate Quiz'}
                        </DialogTitle>
                        <DialogDescription>
                            {isBusy
                                ? 'Please wait while EduCoach creates your quiz.'
                                : phase === 'success'
                                    ? 'Redirecting you to your quiz…'
                                    : phase === 'error'
                                        ? 'Something went wrong. You can try again.'
                                        : 'Choose your quiz settings before generating.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        {/* ── IDLE: selectors ── */}
                        {phase === 'idle' && (
                            <>
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">
                                        Number of Questions
                                    </span>
                                    <div className="flex gap-2">
                                        {QUESTION_COUNT_OPTIONS.map((n) => (
                                            <Button
                                                key={n}
                                                variant={questionCount === n ? 'default' : 'outline'}
                                                size="sm"
                                                className="text-xs flex-1"
                                                onClick={() => setQuestionCount(n)}
                                            >
                                                {n}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">
                                        Difficulty Mix
                                    </span>
                                    <div className="flex gap-2">
                                        {(['mixed', 'easy', 'medium', 'hard'] as const).map((d) => (
                                            <Button
                                                key={d}
                                                variant={difficulty === d ? 'default' : 'outline'}
                                                size="sm"
                                                className="text-xs capitalize flex-1"
                                                onClick={() => setDifficulty(d)}
                                            >
                                                {d}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">
                                        Question Types
                                    </span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {ALL_QUIZ_TYPES.map((type) => {
                                            const label =
                                                type === 'multiple_choice'
                                                    ? 'Multiple Choice'
                                                    : type === 'true_false'
                                                        ? 'True or False'
                                                        : type === 'fill_in_blank'
                                                            ? 'Fill in the Blank'
                                                            : 'Identification'

                                            return (
                                                <label
                                                    key={type}
                                                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs cursor-pointer hover:bg-accent"
                                                >
                                                    <Checkbox
                                                        checked={selectedTypes.includes(type)}
                                                        onCheckedChange={(checked) => {
                                                            setSelectedTypes((prev) => {
                                                                if (checked) {
                                                                    return prev.includes(type)
                                                                        ? prev
                                                                        : [...prev, type]
                                                                }
                                                                return prev.filter((t) => t !== type)
                                                            })
                                                        }}
                                                    />
                                                    <span>{label}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                    {selectedTypes.length > 0 && breakdownText && (
                                        <p className="mt-2 text-[11px] text-muted-foreground">
                                            Breakdown: {breakdownText}
                                        </p>
                                    )}
                                    {typeError && (
                                        <p className="mt-1 text-[11px] text-destructive">
                                            {typeError}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ── GENERATING: loading overlay ── */}
                        {isBusy && (
                            <div className="flex flex-col items-center justify-center py-6">
                                <div className="relative mb-6">
                                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Brain className="w-10 h-10 text-primary" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center">
                                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                    </div>
                                </div>
                                <p className="font-medium mb-1">Creating your quiz…</p>
                                <p className="text-sm text-muted-foreground animate-in fade-in duration-500">
                                    {rotatingMsg}
                                </p>
                                <div className="mt-6 w-full">
                                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                                            style={{ width: '66%', animation: 'pulse 2s ease-in-out infinite' }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                                        Do not close this window
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── SUCCESS ── */}
                        {phase === 'success' && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="font-semibold text-green-600 dark:text-green-400 text-lg">
                                    Your quiz is ready!
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Redirecting you to the quiz…
                                </p>
                            </div>
                        )}

                        {/* ── ERROR ── */}
                        {phase === 'error' && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                                    <AlertCircle className="w-8 h-8 text-destructive" />
                                </div>
                                <p className="font-medium text-destructive">Generation Failed</p>
                                <p className="text-sm text-muted-foreground text-center mt-1 max-w-xs">
                                    {errorMessage}
                                </p>
                                <Button
                                    variant="outline"
                                    className="mt-4"
                                    onClick={() => {
                                        setPhase('idle')
                                        setErrorMessage(null)
                                    }}
                                >
                                    Try Again
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Action buttons (idle only) */}
                    {phase === 'idle' && (
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleGenerate} className="gap-2">
                                <Sparkles className="w-4 h-4" />
                                Generate {questionCount}-Question Quiz
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
