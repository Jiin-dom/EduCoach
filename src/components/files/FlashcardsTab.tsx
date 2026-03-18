import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Layers, ChevronRight, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDocumentFlashcards, useReviewFlashcard, useGenerateFlashcards, type Flashcard } from '@/hooks/useFlashcards'

interface FlashcardsTabProps {
    documentId: string
    documentStatus: string
}

type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export function FlashcardsTab({ documentId, documentStatus }: FlashcardsTabProps) {
    const { data: cards, isLoading } = useDocumentFlashcards(documentId)
    const reviewMutation = useReviewFlashcard()
    const generateFlashcards = useGenerateFlashcards()
    const [studyMode, setStudyMode] = useState(false)
    const [currentIdx, setCurrentIdx] = useState(0)
    const [flipped, setFlipped] = useState(false)
    const [sessionDone, setSessionDone] = useState(0)

    const dueCards = useMemo(() => {
        if (!cards) return []
        const now = new Date().toISOString()
        return cards.filter(c => !c.due_date || c.due_date <= now)
    }, [cards])

    const totalCards = cards?.length ?? 0
    const dueCount = dueCards.length

    const handleRate = async (card: Flashcard, rating: ReviewRating) => {
        await reviewMutation.mutateAsync({ card, rating })
        setFlipped(false)
        setSessionDone(prev => prev + 1)
        if (currentIdx + 1 < dueCards.length) {
            setCurrentIdx(prev => prev + 1)
        } else {
            setStudyMode(false)
            setCurrentIdx(0)
        }
    }

    if (documentStatus !== 'ready') {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Process the document first to generate flashcards.</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        )
    }

    if (totalCards === 0) {
        return (
            <div className="text-center py-12">
                <Layers className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No flashcards yet</h3>
                <p className="text-muted-foreground mb-4 text-sm max-w-sm mx-auto">
                    Flashcards are generated from this document&apos;s key concepts.
                    You can generate a fresh set of flashcards any time.
                </p>
                {documentStatus === 'ready' && (
                    <Button
                        className="mt-2 gap-2"
                        size="sm"
                        disabled={generateFlashcards.isPending || !documentId}
                        onClick={() => documentId && generateFlashcards.mutate(documentId)}
                    >
                        {generateFlashcards.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Layers className="w-4 h-4" />
                        )}
                        Generate flashcards
                    </Button>
                )}
            </div>
        )
    }

    if (studyMode && dueCards.length > 0) {
        const card = dueCards[currentIdx]
        if (!card) {
            setStudyMode(false)
            return null
        }

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Study Session</span>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                            {currentIdx + 1} / {dueCards.length}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => { setStudyMode(false); setCurrentIdx(0); setFlipped(false) }}>
                            Exit
                        </Button>
                    </div>
                </div>
                <Progress value={(currentIdx / dueCards.length) * 100} className="h-1.5" />

                <div className="flex justify-center">
                    <button
                        type="button"
                        className="relative w-full max-w-xl h-64 [perspective:1200px] focus:outline-none"
                        onClick={() => setFlipped(!flipped)}
                    >
                        <div
                            className={`relative w-full h-full rounded-2xl border bg-gradient-to-br from-background to-muted shadow-lg transition-transform duration-500 [transform-style:preserve-3d] ${
                                flipped ? '[transform:rotateY(180deg)]' : ''
                            }`}
                        >
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 [backface-visibility:hidden]">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Question</p>
                                <p className="text-lg font-medium text-center break-words">{card.front}</p>
                                <p className="text-xs text-muted-foreground mt-4">Tap card to reveal the answer</p>
                            </div>

                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Answer</p>
                                <p className="text-sm leading-relaxed text-center break-words">{card.back}</p>
                                <p className="text-xs text-muted-foreground mt-4">Tap card to flip back</p>
                            </div>
                        </div>
                    </button>
                </div>

                {flipped && (
                    <div className="space-y-2">
                        <p className="text-xs text-center text-muted-foreground">How well did you know this?</p>
                        <div className="grid grid-cols-4 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs border-red-200 hover:bg-red-50 text-red-700"
                                onClick={() => handleRate(card, 'again')}
                                disabled={reviewMutation.isPending}
                            >
                                <RotateCcw className="w-3 h-3 mr-1" />Again
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs border-orange-200 hover:bg-orange-50 text-orange-700"
                                onClick={() => handleRate(card, 'hard')}
                                disabled={reviewMutation.isPending}
                            >
                                Hard
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700"
                                onClick={() => handleRate(card, 'good')}
                                disabled={reviewMutation.isPending}
                            >
                                Good
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs border-green-200 hover:bg-green-50 text-green-700"
                                onClick={() => handleRate(card, 'easy')}
                                disabled={reviewMutation.isPending}
                            >
                                <CheckCircle2 className="w-3 h-3 mr-1" />Easy
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{totalCards}</p>
                    <p className="text-xs text-muted-foreground">Total Cards</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/5">
                    <p className="text-2xl font-bold text-primary">{dueCount}</p>
                    <p className="text-xs text-muted-foreground">Due Today</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <p className="text-2xl font-bold text-green-600">{sessionDone}</p>
                    <p className="text-xs text-muted-foreground">Reviewed</p>
                </div>
            </div>

            {dueCount > 0 ? (
                <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => { setStudyMode(true); setCurrentIdx(0); setFlipped(false) }}
                >
                    <ChevronRight className="w-4 h-4" />
                    Study {dueCount} Due Card{dueCount !== 1 ? 's' : ''}
                </Button>
            ) : (
                <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No cards due for review right now.</p>
                </div>
            )}

            <div className="text-center">
                <Link to="/quizzes" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    View all flashcards across documents
                </Link>
            </div>
        </div>
    )
}
