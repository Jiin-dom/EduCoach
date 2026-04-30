import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Brain, ArrowUpDown, X, Sparkles, MessageCircle, FileText, Loader2, CheckCircle2, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Concept } from '@/hooks/useConcepts'
import { getDifficultyColor, getImportanceColor } from '@/hooks/useConcepts'
import { useConceptMasteryByDocument, useMarkConceptReviewed } from '@/hooks/useLearning'
import { useGenerateQuiz } from '@/hooks/useQuizzes'
import { cleanDisplayText } from '@/lib/studyUtils'
import { isReviewedOnDate } from '@/lib/conceptReviewState'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ConceptsTabProps {
    concepts: Concept[]
    isLoading: boolean
    documentStatus: string
    onPageJump?: (page: number) => void
    onAskTutor?: (prompt: string) => void
    documentId?: string
    focusedConceptId?: string
}

type SortField = 'importance' | 'difficulty' | 'name'

const DIFFICULTY_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }

export function ConceptsTab({ concepts, isLoading, documentStatus, onPageJump, onAskTutor, documentId, focusedConceptId }: ConceptsTabProps) {
    const navigate = useNavigate()
    const generateQuiz = useGenerateQuiz()
    const markConceptReviewed = useMarkConceptReviewed()
    const { data: conceptMastery = [] } = useConceptMasteryByDocument(documentId)
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState<SortField>('importance')
    const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null)
    const [locallyReviewedConceptIds, setLocallyReviewedConceptIds] = useState<Set<string>>(new Set())
    const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])
    const masteryByConceptId = useMemo(
        () => new Map(conceptMastery.map((row) => [row.concept_id, row])),
        [conceptMastery],
    )

    const filtered = useMemo(() => {
        let list = [...concepts]

        if (search) {
            const q = search.toLowerCase()
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.description || '').toLowerCase().includes(q) ||
                (c.category || '').toLowerCase().includes(q)
            )
        }

        list.sort((a, b) => {
            if (sortBy === 'importance') return b.importance - a.importance
            if (sortBy === 'difficulty') return (DIFFICULTY_ORDER[b.difficulty_level || 'intermediate'] || 1) - (DIFFICULTY_ORDER[a.difficulty_level || 'intermediate'] || 1)
            return a.name.localeCompare(b.name)
        })
        const focusedIndex = list.findIndex((concept) => concept.id === focusedConceptId)
        if (focusedIndex > 0) {
            list.unshift(...list.splice(focusedIndex, 1))
        }

        return list
    }, [concepts, search, sortBy, focusedConceptId])

    const cycleSortField = () => {
        const order: SortField[] = ['importance', 'difficulty', 'name']
        const idx = order.indexOf(sortBy)
        setSortBy(order[(idx + 1) % order.length])
    }

    const handleMarkReviewed = (concept: Concept) => {
        const mastery = masteryByConceptId.get(concept.id)
        if (!mastery) {
            toast.info('Review not tracked yet', {
                description: 'Take a quiz first so EduCoach can start tracking this concept.',
            })
            return
        }

        markConceptReviewed.mutate(
            {
                conceptId: mastery.concept_id,
                masteryScore: Number(mastery.mastery_score) || 0,
                confidence: Number(mastery.confidence) || 0,
                repetition: Number(mastery.repetition) || 0,
                intervalDays: Number(mastery.interval_days) || 1,
                easeFactor: Number(mastery.ease_factor) || 2.5,
            },
            {
                onSuccess: (result) => {
                    setLocallyReviewedConceptIds((prev) => {
                        const next = new Set(prev)
                        next.add(concept.id)
                        return next
                    })
                    toast.success('Concept reviewed', {
                        description: `${cleanDisplayText(concept.name)} reviewed. Next review: ${new Date(result.dueDate).toLocaleDateString()}.`,
                    })
                },
                onError: (error) => toast.error('Could not mark reviewed', {
                    description: error instanceof Error ? error.message : 'Please try again.',
                }),
            },
        )
    }

    if (documentStatus === 'pending' || documentStatus === 'processing') {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{documentStatus === 'processing' ? 'Extracting concepts...' : 'Process the document to see concepts.'}</p>
            </div>
        )
    }

    if (isLoading) {
        return <div className="flex items-center justify-center py-12"><div className="animate-pulse h-4 w-32 bg-muted rounded" /></div>
    }

    if (concepts.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No concepts extracted from this document.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search concepts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-9"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5">
                            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                    )}
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs" onClick={cycleSortField}>
                    <ArrowUpDown className="w-3 h-3" />
                    {sortBy === 'importance' ? 'Importance' : sortBy === 'difficulty' ? 'Difficulty' : 'Name'}
                </Button>
                <Badge variant="secondary" className="text-xs h-9 px-3 flex items-center">
                    {filtered.length} concept{filtered.length !== 1 ? 's' : ''}
                </Badge>
            </div>

            {/* Concept list */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((concept) => {
                    const name = cleanDisplayText(concept.name)
                    const desc = cleanDisplayText(concept.description || '')
                    const firstSentence = desc.split(/[.!?]/)[0]?.trim()
                    const mastery = masteryByConceptId.get(concept.id)
                    const isFocusedConcept = concept.id === focusedConceptId
                    const isDue = !!mastery && mastery.due_date <= todayIso
                    const isReviewedToday = locallyReviewedConceptIds.has(concept.id) || isReviewedOnDate(mastery?.last_reviewed_at, todayIso)
                    const showReviewAction = isFocusedConcept || isDue || isReviewedToday
                    const isReviewingThisConcept = markConceptReviewed.isPending && markConceptReviewed.variables?.conceptId === concept.id
                    const sourcePages = concept.source_pages || []
                    const keywords = concept.keywords || []

                    return (
                        <div
                            key={concept.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedConcept(concept)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    setSelectedConcept(concept)
                                }
                            }}
                            className={cn(
                                "group relative flex h-full min-h-[240px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.04] p-5 text-left shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 active:scale-[0.995]",
                                isFocusedConcept && "border-primary bg-primary/5 shadow-primary/10",
                            )}
                            style={{ contentVisibility: 'auto', containIntrinsicSize: '240px' }}
                        >
                            <div className="flex h-full flex-col gap-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-3 flex items-center gap-2">
                                            <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getImportanceColor(concept.importance)}`} />
                                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                {concept.category ? cleanDisplayText(concept.category) : 'Core Concept'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="line-clamp-2 text-base font-semibold leading-snug transition-colors group-hover:text-primary">
                                                {name}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-primary/8 px-3 py-2 text-right">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Impact</div>
                                        <div className="text-lg font-semibold text-foreground">{concept.importance}/10</div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {concept.difficulty_level && (
                                            <Badge variant="outline" className={`text-[10px] ${getDifficultyColor(concept.difficulty_level)}`}>
                                                {concept.difficulty_level}
                                            </Badge>
                                        )}
                                        {sourcePages.length > 0 && (
                                            <Badge variant="secondary" className="text-[10px]">
                                                {sourcePages.length} page{sourcePages.length !== 1 ? 's' : ''}
                                            </Badge>
                                        )}
                                    </div>
                                    {firstSentence && (
                                        <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                                            {firstSentence}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-auto space-y-3">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                            <span>Importance</span>
                                            <span>{concept.importance * 10}%</span>
                                        </div>
                                        <Progress value={concept.importance * 10} className="h-2" />
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 min-w-0">
                                        {keywords.slice(0, 3).map((kw) => (
                                            <Badge key={kw} variant="secondary" className="text-[10px]">
                                                {kw}
                                            </Badge>
                                        ))}
                                        {keywords.length > 3 && (
                                            <Badge variant="secondary" className="text-[10px]">
                                                +{keywords.length - 3} more
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {sourcePages.slice(0, 4).map((p) => (
                                            <Badge
                                                key={p}
                                                variant="outline"
                                                className="text-[10px] gap-0.5 cursor-pointer hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                                onClick={(e) => { e.stopPropagation(); onPageJump?.(p) }}
                                            >
                                                <FileText className="w-2.5 h-2.5" />p.{p}
                                            </Badge>
                                        ))}
                                        {sourcePages.length > 4 && (
                                            <Badge variant="outline" className="text-[10px]">
                                                +{sourcePages.length - 4}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                    {showReviewAction && (
                                        <div>
                                            <Button
                                                type="button"
                                                variant={isReviewedToday ? "secondary" : "outline"}
                                                size="sm"
                                                className={cn(
                                                    "h-8 gap-1.5 rounded-xl px-2 text-[11px]",
                                                    isReviewedToday && "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700",
                                                )}
                                                disabled={isReviewingThisConcept || isReviewedToday}
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    handleMarkReviewed(concept)
                                                }}
                                            >
                                                {isReviewingThisConcept ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className={cn("h-3.5 w-3.5", isReviewedToday && "fill-emerald-100 text-emerald-600")} />
                                                )}
                                                {isReviewedToday ? 'Reviewed Today' : 'Mark Reviewed'}
                                            </Button>
                                        </div>
                                    )}
                            </div>

                            <div className="pointer-events-none absolute right-4 top-4 flex translate-x-1 items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                                Open <ChevronRight className="h-3 w-3" />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Concept detail dialog */}
            <Dialog open={!!selectedConcept} onOpenChange={(open) => { if (!open) setSelectedConcept(null) }}>
                {selectedConcept && (
                    <DialogContent className="max-w-3xl p-0 overflow-hidden [&_[data-slot=dialog-close]]:top-5 [&_[data-slot=dialog-close]]:right-5 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:p-2 [&_[data-slot=dialog-close]]:bg-background/80 [&_[data-slot=dialog-close]]:backdrop-blur [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-border/60 [&_[data-slot=dialog-close]]:opacity-90 [&_[data-slot=dialog-close]]:hover:opacity-100 [&_[data-slot=dialog-close]]:hover:bg-muted">
                        <div className="max-h-[80vh] overflow-y-auto">
                            <div className="border-b bg-background py-5 pl-6 pr-16">
                                <DialogHeader className="space-y-2">
                                    <DialogTitle className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className={`mt-1 w-3 h-3 rounded-full ${getImportanceColor(selectedConcept.importance)}`} />
                                                <span className="text-xl font-semibold leading-snug">
                                                    {cleanDisplayText(selectedConcept.name)}
                                                </span>
                                                {selectedConcept.difficulty_level && (
                                                    <Badge variant="outline" className={`text-xs ${getDifficultyColor(selectedConcept.difficulty_level)}`}>
                                                        {selectedConcept.difficulty_level}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                {selectedConcept.category && (
                                                    <Badge variant="secondary" className="text-[11px]">
                                                        {cleanDisplayText(selectedConcept.category)}
                                                    </Badge>
                                                )}
                                                {selectedConcept.source_pages?.length ? (
                                                    <Badge variant="secondary" className="text-[11px]">
                                                        {selectedConcept.source_pages.length} page{selectedConcept.source_pages.length !== 1 ? 's' : ''}
                                                    </Badge>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-border/60 bg-card px-4 py-3 text-right">
                                            <div className="text-xs font-medium text-muted-foreground">Importance</div>
                                            <div className="mt-0.5 text-2xl font-semibold text-foreground">{selectedConcept.importance}/10</div>
                                        </div>
                                    </DialogTitle>
                                </DialogHeader>
                            </div>

                            <div className="grid gap-5 px-6 py-5 md:grid-cols-[1.3fr_0.9fr]">
                                <div className="space-y-5">
                                    <div className="rounded-2xl border border-border/60 bg-card p-5">
                                        <div className="text-sm font-medium text-foreground">Definition</div>
                                        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                                            {cleanDisplayText(selectedConcept.description || 'No description available.')}
                                        </p>
                                    </div>

                                    {selectedConcept.keywords && selectedConcept.keywords.length > 0 && (
                                        <div className="rounded-2xl border border-border/60 bg-card p-5">
                                            <div className="text-sm font-medium text-foreground">Keywords</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {selectedConcept.keywords.map((kw) => (
                                                    <Badge key={kw} variant="secondary" className="text-xs">
                                                        {kw}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-border/60 bg-card p-5">
                                        <div className="flex items-center justify-between text-sm font-medium text-foreground">
                                            <span>Importance</span>
                                            <span>{selectedConcept.importance * 10}%</span>
                                        </div>
                                        <Progress value={selectedConcept.importance * 10} className="mt-2 h-2.5" />
                                    </div>

                                    {selectedConcept.source_pages && selectedConcept.source_pages.length > 0 && (
                                        <div className="rounded-2xl border border-border/60 bg-card p-5">
                                            <div className="text-sm font-medium text-foreground">Source pages</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {selectedConcept.source_pages.map((p) => (
                                                    <Badge
                                                        key={p}
                                                        variant="outline"
                                                        className="text-xs gap-1 cursor-pointer hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                                        onClick={() => onPageJump?.(p)}
                                                    >
                                                        <FileText className="w-3 h-3" />Page {p}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="border-t bg-background px-6 py-4">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-sm flex-1 h-10 rounded-xl"
                                    onClick={() => {
                                        const name = cleanDisplayText(selectedConcept.name)
                                        onAskTutor?.(`Explain "${name}" like I'm a complete beginner. Use simple analogies and everyday examples.`)
                                        setSelectedConcept(null)
                                    }}
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Explain like I&apos;m new
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-sm flex-1 h-10 rounded-xl"
                                    disabled={!documentId || generateQuiz.isPending}
                                    onClick={() => {
                                        if (!documentId) return
                                        generateQuiz.mutate(
                                            { documentId, questionCount: 5, enhanceWithLlm: true },
                                            { onSuccess: (data) => navigate(data?.quizId ? `/quizzes/${data.quizId}` : '/quizzes') }
                                        )
                                    }}
                                >
                                    {generateQuiz.isPending
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Sparkles className="w-3.5 h-3.5" />
                                    }
                                    Quiz me on this
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    )
}
