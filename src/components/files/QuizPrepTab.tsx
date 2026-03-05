import { useState, useMemo } from 'react'
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

interface QuizPrepTabProps {
    documentId: string
    concepts: Concept[]
    documentStatus: string
}

export function QuizPrepTab({ documentId, concepts, documentStatus }: QuizPrepTabProps) {
    const navigate = useNavigate()
    const generateQuiz = useGenerateQuiz()
    const [difficulty, setDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed')
    const [reviewedConcepts, setReviewedConcepts] = useState<Set<string>>(new Set())

    const topConcepts = useMemo(
        () => [...concepts].sort((a, b) => b.importance - a.importance).slice(0, 8),
        [concepts]
    )

    const handleGenerate = () => {
        generateQuiz.mutate(
            { documentId, questionCount: 10, enhanceWithLlm: true },
            { onSuccess: (data) => navigate(data?.quizId ? `/quizzes/${data.quizId}` : '/quizzes') }
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

            {/* Generate CTA */}
            <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleGenerate}
                disabled={generateQuiz.isPending}
            >
                {generateQuiz.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />
                }
                Generate 10-Question Quiz
            </Button>
        </div>
    )
}
