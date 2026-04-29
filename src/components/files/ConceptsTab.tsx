import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Brain, ArrowUpDown, X, Sparkles, MessageCircle, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Concept } from '@/hooks/useConcepts'
import { getDifficultyColor, getImportanceColor } from '@/hooks/useConcepts'
import { useConceptMasteryByDocument, useMarkConceptReviewed } from '@/hooks/useLearning'
import { useGenerateQuiz } from '@/hooks/useQuizzes'
import { cleanDisplayText } from '@/lib/studyUtils'
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
                onSuccess: () => toast.success('Concept reviewed', {
                    description: `${cleanDisplayText(concept.name)} is scheduled for later.`,
                }),
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
            <div className="space-y-2">
                {filtered.map((concept) => {
                    const name = cleanDisplayText(concept.name)
                    const desc = cleanDisplayText(concept.description || '')
                    const firstSentence = desc.split(/[.!?]/)[0]?.trim()
                    const mastery = masteryByConceptId.get(concept.id)
                    const isFocusedConcept = concept.id === focusedConceptId
                    const isDue = !!mastery && mastery.due_date <= todayIso
                    const showReviewAction = isFocusedConcept || isDue

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
                                "cursor-pointer",
                                "w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors group",
                                isFocusedConcept && "border-primary bg-primary/5",
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getImportanceColor(concept.importance)}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm group-hover:text-primary transition-colors">{name}</span>
                                        {concept.difficulty_level && (
                                            <Badge variant="outline" className={`text-[10px] ${getDifficultyColor(concept.difficulty_level)}`}>
                                                {concept.difficulty_level}
                                            </Badge>
                                        )}
                                    </div>
                                    {firstSentence && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{firstSentence}</p>
                                    )}
                                    <div className="flex flex-wrap gap-1 mt-2 min-w-0">
                                        {(concept.keywords || []).slice(0, 3).map((kw) => (
                                            <Badge key={kw} variant="secondary" className="text-[10px] hidden sm:inline-flex">{kw}</Badge>
                                        ))}
                                        {concept.source_pages?.slice(0, 6).map((p) => (
                                            <Badge
                                                key={p}
                                                variant="outline"
                                                className="text-[10px] gap-0.5 cursor-pointer hover:bg-primary/10 hidden sm:inline-flex"
                                                onClick={(e) => { e.stopPropagation(); onPageJump?.(p) }}
                                            >
                                                <FileText className="w-2.5 h-2.5" />p.{p}
                                            </Badge>
                                        ))}
                                        {(concept.source_pages?.length ?? 0) > 6 && (
                                            <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
                                                +{concept.source_pages!.length - 6}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="w-28 flex-shrink-0 pt-1 flex flex-col items-end gap-2">
                                    <Progress value={concept.importance * 10} className="h-1.5 w-16" />
                                    {showReviewAction && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 gap-1.5 px-2 text-[11px]"
                                            disabled={markConceptReviewed.isPending}
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                handleMarkReviewed(concept)
                                            }}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Mark Reviewed
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Concept detail dialog */}
            <Dialog open={!!selectedConcept} onOpenChange={(open) => { if (!open) setSelectedConcept(null) }}>
                {selectedConcept && (
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${getImportanceColor(selectedConcept.importance)}`} />
                                {cleanDisplayText(selectedConcept.name)}
                                {selectedConcept.difficulty_level && (
                                    <Badge variant="outline" className={`text-xs ${getDifficultyColor(selectedConcept.difficulty_level)}`}>
                                        {selectedConcept.difficulty_level}
                                    </Badge>
                                )}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            {selectedConcept.category && (
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</span>
                                    <p className="text-sm mt-0.5">{selectedConcept.category}</p>
                                </div>
                            )}

                            <div>
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Definition</span>
                                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                                    {cleanDisplayText(selectedConcept.description || 'No description available.')}
                                </p>
                            </div>

                            <div>
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Importance</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <Progress value={selectedConcept.importance * 10} className="h-2 flex-1" />
                                    <span className="text-xs text-muted-foreground">{selectedConcept.importance}/10</span>
                                </div>
                            </div>

                            {selectedConcept.keywords && selectedConcept.keywords.length > 0 && (
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Keywords</span>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {selectedConcept.keywords.map((kw) => (
                                            <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedConcept.source_pages && selectedConcept.source_pages.length > 0 && (
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source</span>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {selectedConcept.source_pages.map((p) => (
                                            <Badge
                                                key={p}
                                                variant="outline"
                                                className="text-xs gap-1 cursor-pointer hover:bg-primary/10"
                                                onClick={() => onPageJump?.(p)}
                                            >
                                                <FileText className="w-3 h-3" />Page {p}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-xs flex-1"
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
                                    className="gap-1.5 text-xs flex-1"
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
