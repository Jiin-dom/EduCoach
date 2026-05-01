import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Layers, ChevronRight, RotateCcw, CheckCircle2, Loader2, Maximize2, Minimize2, X, Sparkles } from 'lucide-react'
import { useDocumentFlashcards, useReviewFlashcard, useGenerateFlashcards, type Flashcard } from '@/hooks/useFlashcards'
import { cn } from '@/lib/utils'

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
    const [sessionCards, setSessionCards] = useState<Flashcard[]>([])
    const [isFullscreen, setIsFullscreen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`)
            })
        } else {
            document.exitFullscreen()
        }
    }

    useEffect(() => {
        if (!studyMode || !sessionCards.length) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                setFlipped(prev => !prev)
            } else if (e.key === 'f' || e.key === 'F') {
                toggleFullscreen()
            } else if (e.key === 'Escape' && isFullscreen) {
                // Browser handles exiting fullscreen, but we can sync state if needed
            } else if (flipped) {
                const card = sessionCards[currentIdx]
                if (e.key === '1') handleRate(card, 'again')
                if (e.key === '2') handleRate(card, 'hard')
                if (e.key === '3') handleRate(card, 'good')
                if (e.key === '4') handleRate(card, 'easy')
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [studyMode, flipped, sessionCards, currentIdx, isFullscreen])

    const dueCards = useMemo(() => {
        if (!cards) return []
        const now = new Date().toISOString()
        return cards.filter(c => !c.due_date || c.due_date <= now)
    }, [cards])

    const totalCards = cards?.length ?? 0
    const dueCount = dueCards.length

    const exitStudyMode = () => {
        setStudyMode(false)
        setCurrentIdx(0)
        setFlipped(false)
        setSessionCards([])
    }

    const handleRate = async (card: Flashcard, rating: ReviewRating) => {
        await reviewMutation.mutateAsync({
            card,
            rating,
        })
        setFlipped(false)
        setSessionDone(prev => prev + 1)
        if (currentIdx + 1 < sessionCards.length) {
            setCurrentIdx(prev => prev + 1)
        } else {
            exitStudyMode()
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

    if (studyMode && sessionCards.length > 0) {
        const card = sessionCards[currentIdx]
        const prevCard = currentIdx > 0 ? sessionCards[currentIdx - 1] : null
        const nextCard = currentIdx + 1 < sessionCards.length ? sessionCards[currentIdx + 1] : null
        if (!card) {
            exitStudyMode()
            return null
        }

        return (
            <div
                ref={containerRef}
                className={cn(
                    "space-y-5 transition-all duration-500 ease-in-out",
                    isFullscreen ? "fixed inset-0 z-50 flex flex-col justify-center items-center bg-background p-6 md:p-12 overflow-hidden" : "relative"
                )}
            >
                {isFullscreen && (
                    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
                        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
                    </div>
                )}

                <div className={cn(
                    "flex items-center justify-between w-full",
                    isFullscreen ? "max-w-4xl mb-8" : ""
                )}>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-xl bg-primary/10 text-primary transition-all",
                            isFullscreen ? "scale-110" : ""
                        )}>
                            <Layers className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className={cn("font-bold tracking-tight", isFullscreen ? "text-xl" : "text-sm")}>Study Session</h3>
                            {isFullscreen && <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Focus Mode</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={cn(
                            "rounded-full px-3 font-semibold",
                            isFullscreen ? "text-sm py-1" : "text-xs px-2.5"
                        )}>
                            {currentIdx + 1} / {sessionCards.length}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-muted"
                            onClick={toggleFullscreen}
                            title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size={isFullscreen ? "default" : "sm"}
                            className={cn("rounded-full", isFullscreen ? "bg-muted/50 hover:bg-muted" : "")}
                            onClick={() => exitStudyMode()}
                        >
                            {isFullscreen ? <X className="w-4 h-4 mr-2" /> : null}
                            Exit
                        </Button>
                    </div>
                </div>

                <div className={cn("w-full", isFullscreen ? "max-w-4xl" : "")}>
                    <Progress value={((currentIdx + 1) / sessionCards.length) * 100} className={cn("transition-all", isFullscreen ? "h-2" : "h-1.5")} />
                </div>

                <div className={cn(
                    "flex justify-center w-full",
                    isFullscreen ? "flex-1 flex items-center" : ""
                )}>
                    <div className={cn(
                        "relative w-full",
                        isFullscreen ? "max-w-4xl" : "max-w-3xl"
                    )}>
                        {!isFullscreen && prevCard && (
                            <div className="pointer-events-none absolute left-0 top-1/2 hidden h-52 w-[42%] -translate-y-1/2 rounded-2xl border border-border/60 bg-card/70 p-4 opacity-70 shadow-sm blur-[0.2px] md:block">
                                <p className="text-[11px] text-muted-foreground">Previous</p>
                                <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{prevCard.front}</p>
                            </div>
                        )}

                        {!isFullscreen && nextCard && (
                            <div className="pointer-events-none absolute right-0 top-1/2 hidden h-52 w-[42%] -translate-y-1/2 rounded-2xl border border-border/60 bg-card/70 p-4 opacity-70 shadow-sm blur-[0.2px] md:block">
                                <p className="text-[11px] text-muted-foreground">Next</p>
                                <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{nextCard.front}</p>
                            </div>
                        )}

                        <button
                            type="button"
                            className={cn(
                                "relative z-10 mx-auto block w-full [perspective:1200px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-500 ease-in-out",
                                isFullscreen ? "max-w-2xl aspect-[16/10] h-auto" : "max-w-xl h-[24rem]"
                            )}
                            onClick={() => setFlipped(!flipped)}
                        >
                            <div
                                className={cn(
                                    "relative h-full w-full rounded-[2rem] border border-border/60 bg-card shadow-2xl transition-[transform,box-shadow] duration-700 [transform-style:preserve-3d] will-change-transform cursor-pointer hover:shadow-primary/5",
                                    flipped ? "[transform:rotateY(180deg)]" : "",
                                    isFullscreen ? "border-primary/20" : ""
                                )}
                            >
                                <div className="absolute inset-0 flex min-h-0 flex-col items-center justify-center p-8 md:p-12 [backface-visibility:hidden]">
                                    <div className="mb-6 flex flex-col items-center gap-1">
                                        <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/5 border-primary/20">Question</Badge>
                                    </div>
                                    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
                                        <p className={cn(
                                            "w-full text-center font-semibold leading-relaxed break-words whitespace-pre-wrap transition-all duration-500",
                                            isFullscreen ? "text-3xl md:text-4xl" : "text-xl"
                                        )}>{card.front}</p>
                                    </div>
                                    <div className="mt-auto pt-8 flex items-center gap-2 text-muted-foreground/60 group">
                                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                        <p className="text-[11px] font-medium uppercase tracking-widest">Tap or Press Space to reveal</p>
                                    </div>
                                </div>

                                <div className="absolute inset-0 flex min-h-0 flex-col items-center justify-center p-8 md:p-12 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                                    <div className="mb-6 flex flex-col items-center gap-1">
                                        <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-green-600 bg-green-50 border-green-200">Answer</Badge>
                                    </div>
                                    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto custom-scrollbar">
                                        <p className={cn(
                                            "w-full text-center leading-relaxed break-words whitespace-pre-wrap font-medium transition-all duration-500",
                                            isFullscreen ? "text-xl md:text-2xl" : "text-sm"
                                        )}>{card.back}</p>
                                    </div>
                                    <div className="mt-auto pt-8 flex items-center gap-2 text-muted-foreground/60">
                                        <p className="text-[11px] font-medium uppercase tracking-widest">Tap to flip back</p>
                                    </div>
                                </div>
                            </div>
                        </button>

                        <div className="mt-6 flex items-center justify-center gap-2">
                            {sessionCards.map((_, idx) => (
                                <span
                                    key={`dot-${idx}`}
                                    className={cn(
                                        "h-1.5 rounded-full transition-all duration-500",
                                        idx === currentIdx ? "w-8 bg-primary shadow-sm shadow-primary/20" : "w-1.5 bg-muted-foreground/20",
                                        isFullscreen ? "h-2" : ""
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className={cn(
                    "w-full transition-all duration-500",
                    isFullscreen ? "max-w-4xl mt-4 mb-8" : "mt-2"
                )}>
                    {flipped ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <p className={cn(
                                "text-center text-muted-foreground font-medium",
                                isFullscreen ? "text-sm" : "text-xs"
                            )}>How well did you know this?</p>
                            <div className={cn(
                                "grid grid-cols-4 gap-3",
                                isFullscreen ? "max-w-2xl mx-auto" : ""
                            )}>
                                <Button
                                    variant="outline"
                                    size={isFullscreen ? "lg" : "sm"}
                                    className="group relative flex flex-col items-center gap-1 h-auto py-3 border-red-100 hover:bg-red-50 hover:border-red-200 text-red-600 rounded-2xl transition-all hover:scale-[1.02]"
                                    onClick={() => handleRate(card, 'again')}
                                    disabled={reviewMutation.isPending}
                                >
                                    <RotateCcw className="w-4 h-4 mb-0.5 group-hover:rotate-[-45deg] transition-transform" />
                                    <span className="font-bold">Again</span>
                                    {isFullscreen && <span className="text-[10px] opacity-60 font-medium">Press 1</span>}
                                </Button>
                                <Button
                                    variant="outline"
                                    size={isFullscreen ? "lg" : "sm"}
                                    className="group relative flex flex-col items-center gap-1 h-auto py-3 border-orange-100 hover:bg-orange-50 hover:border-orange-200 text-orange-600 rounded-2xl transition-all hover:scale-[1.02]"
                                    onClick={() => handleRate(card, 'hard')}
                                    disabled={reviewMutation.isPending}
                                >
                                    <span className="text-lg mb-0.5">😰</span>
                                    <span className="font-bold">Hard</span>
                                    {isFullscreen && <span className="text-[10px] opacity-60 font-medium">Press 2</span>}
                                </Button>
                                <Button
                                    variant="outline"
                                    size={isFullscreen ? "lg" : "sm"}
                                    className="group relative flex flex-col items-center gap-1 h-auto py-3 border-blue-100 hover:bg-blue-50 hover:border-blue-200 text-blue-600 rounded-2xl transition-all hover:scale-[1.02]"
                                    onClick={() => handleRate(card, 'good')}
                                    disabled={reviewMutation.isPending}
                                >
                                    <span className="text-lg mb-0.5">😊</span>
                                    <span className="font-bold">Good</span>
                                    {isFullscreen && <span className="text-[10px] opacity-60 font-medium">Press 3</span>}
                                </Button>
                                <Button
                                    variant="outline"
                                    size={isFullscreen ? "lg" : "sm"}
                                    className="group relative flex flex-col items-center gap-1 h-auto py-3 border-green-100 hover:bg-green-50 hover:border-green-200 text-green-600 rounded-2xl transition-all hover:scale-[1.02]"
                                    onClick={() => handleRate(card, 'easy')}
                                    disabled={reviewMutation.isPending}
                                >
                                    <CheckCircle2 className="w-4 h-4 mb-0.5 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold">Easy</span>
                                    {isFullscreen && <span className="text-[10px] opacity-60 font-medium">Press 4</span>}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[84px] md:h-[104px] flex items-center justify-center">
                             <div className="flex items-center gap-2 text-muted-foreground/40 animate-pulse">
                                <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Ready for the answer?</span>
                             </div>
                        </div>
                    )}
                </div>
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
                <div className="space-y-3">
                    <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={() => {
                            setSessionCards(dueCards)
                            setStudyMode(true)
                            setCurrentIdx(0)
                            setFlipped(false)
                        }}
                    >
                        <ChevronRight className="w-4 h-4" />
                        Study {dueCount} Due Card{dueCount !== 1 ? 's' : ''}
                    </Button>

                    <div className="rounded-xl border border-border/60 bg-card p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold">Due Today Cards</p>
                            <Badge variant="secondary" className="text-[11px]">
                                {dueCount} card{dueCount !== 1 ? 's' : ''}
                            </Badge>
                        </div>
                        <div className="max-h-64 space-y-2 overflow-auto pr-1">
                            {dueCards.map((card, idx) => (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => {
                                        setSessionCards(dueCards)
                                        setStudyMode(true)
                                        setCurrentIdx(idx)
                                        setFlipped(false)
                                    }}
                                    className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                                >
                                    <p className="line-clamp-2 text-sm font-medium leading-snug">{card.front}</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        Tap to start from this card
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No cards due for review right now.</p>
                </div>
            )}

        </div>
    )
}
