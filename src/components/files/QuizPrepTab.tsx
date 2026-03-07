import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Brain } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Concept } from '@/hooks/useConcepts'
import { getDifficultyColor, getImportanceColor } from '@/hooks/useConcepts'
import { useGenerateQuiz } from '@/hooks/useQuizzes'
import { cleanDisplayText } from '@/lib/studyUtils'

const GENERATING_MESSAGES = [
    'Analyzing document concepts…',
    'Crafting questions from key topics…',
    'Building answer choices…',
    'Applying difficulty settings…',
    'Validating question quality…',
    'Almost there, finalizing your quiz…',
]

interface QuizPrepTabProps {
    documentId: string
    concepts: Concept[]
    documentStatus: string
}

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const

type GeneratePhase = 'idle' | 'generating' | 'success' | 'error'

export function QuizPrepTab({ documentId, concepts, documentStatus }: QuizPrepTabProps) {
    const navigate = useNavigate()
    const generateQuiz = useGenerateQuiz()
    const [difficulty, setDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed')
    const [questionCount, setQuestionCount] = useState<number>(10)
    const [reviewedConcepts, setReviewedConcepts] = useState<Set<string>>(new Set())
    const [generationError, setGenerationError] = useState<string | null>(null)
    const [phase, setPhase] = useState<GeneratePhase>('idle')
    const [rotatingMsg, setRotatingMsg] = useState('')
    const rotatingIndex = useRef(0)

    const isBusy = phase === 'generating'

    useEffect(() => {
        if (!isBusy) return
        const interval = setInterval(() => {
            rotatingIndex.current = (rotatingIndex.current + 1) % GENERATING_MESSAGES.length
            setRotatingMsg(GENERATING_MESSAGES[rotatingIndex.current])
        }, 4000)
        return () => clearInterval(interval)
    }, [isBusy])

    const topConcepts = useMemo(
        () => [...concepts].sort((a, b) => b.importance - a.importance).slice(0, 8),
        [concepts]
    )

    const handleGenerate = () => {
        setGenerationError(null)
        setPhase('generating')
        rotatingIndex.current = 0
        setRotatingMsg(GENERATING_MESSAGES[0])
        generateQuiz.mutate(
            { documentId, questionCount, difficulty, enhanceWithLlm: true },
            {
                onSuccess: (data) => {
                    setPhase('success')
                    setTimeout(() => {
                        navigate(data?.quizId ? `/quizzes/${data.quizId}` : '/quizzes')
                    }, 1500)
                },
                onError: (err) => {
                    setPhase('error')
                    setGenerationError(err instanceof Error ? err.message : 'Failed to generate quiz. Please try again.')
                },
            }
        )
    }

    const toggleReviewed = (id: string) => {
        setReviewedConcepts(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    if (documentStatus !== 'ready') {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Process the document first to prepare for a quiz.</p>
            </div>
        )
    }

    const reviewProgress = topConcepts.length > 0 ? (reviewedConcepts.size / topConcepts.length) * 100 : 0

    return (
        <>
        {/* Full-screen blocking overlay while generating */}
        {(isBusy || phase === 'success') && (
            <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-background border rounded-2xl shadow-lg p-8 max-w-sm w-full mx-4 flex flex-col items-center">
                    {isBusy && (
                        <>
                            <div className="relative mb-6">
                                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Brain className="w-10 h-10 text-primary" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center">
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                </div>
                            </div>
                            <p className="font-medium mb-1">Creating your quiz…</p>
                            <p className="text-sm text-muted-foreground animate-in fade-in duration-500 text-center">
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
                                    Please wait — do not navigate away
                                </p>
                            </div>
                        </>
                    )}
                    {phase === 'success' && (
                        <>
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="font-semibold text-green-600 dark:text-green-400 text-lg">
                                Your quiz is ready!
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Redirecting you to the quiz…
                            </p>
                        </>
                    )}
                </div>
            </div>
        )}

        <div className="space-y-6">
            {/* What you should know */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        What you should know
                    </h3>
                    <span className="text-xs text-muted-foreground">
                        {reviewedConcepts.size}/{topConcepts.length} reviewed
                    </span>
                </div>
                <Progress value={reviewProgress} className="h-2 mb-4" />

                <div className="space-y-2">
                    {topConcepts.map((concept) => {
                        const isReviewed = reviewedConcepts.has(concept.id)
                        return (
                            <div
                                key={concept.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                    isReviewed ? 'bg-green-50/50 border-green-200 dark:bg-green-950/20' : 'hover:bg-accent/50'
                                }`}
                            >
                                <Checkbox
                                    checked={isReviewed}
                                    onCheckedChange={() => toggleReviewed(concept.id)}
                                />
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getImportanceColor(concept.importance)}`} />
                                <div className="flex-1 min-w-0">
                                    <span className={`text-sm font-medium ${isReviewed ? 'line-through text-muted-foreground' : ''}`}>
                                        {cleanDisplayText(concept.name)}
                                    </span>
                                </div>
                                {concept.difficulty_level && (
                                    <Badge variant="outline" className={`text-[10px] ${getDifficultyColor(concept.difficulty_level)}`}>
                                        {concept.difficulty_level}
                                    </Badge>
                                )}
                                {isReviewed && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Common pitfalls */}
            {concepts.some(c => (c.description || '').toLowerCase().includes('challeng') || (c.description || '').toLowerCase().includes('pitfall')) && (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700">Common Pitfalls</span>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
                        {concepts
                            .filter(c => (c.description || '').toLowerCase().includes('challeng') || (c.description || '').toLowerCase().includes('pitfall'))
                            .slice(0, 3)
                            .map(c => (
                                <li key={c.id}>{cleanDisplayText(c.description || c.name).split('.')[0]}.</li>
                            ))}
                    </ul>
                </div>
            )}

            {/* Question count */}
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
                            className="text-xs"
                            onClick={() => setQuestionCount(n)}
                        >
                            {n}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Difficulty selection */}
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
                            className="text-xs capitalize"
                            onClick={() => setDifficulty(d)}
                        >
                            {d}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Error display */}
            {generationError && phase === 'error' && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-red-700 dark:text-red-400">{generationError}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 text-xs"
                                onClick={() => { setPhase('idle'); setGenerationError(null) }}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Generate CTA */}
            <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleGenerate}
                disabled={isBusy}
            >
                {isBusy
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />
                }
                Generate {questionCount}-Question Quiz
            </Button>
        </div>
        </>
    )
}
