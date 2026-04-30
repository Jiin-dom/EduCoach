import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, Loader2, AlertCircle, BookOpen, Brain, StickyNote, Layers, FileText, Sparkles } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useDocument, useProcessDocument } from '@/hooks/useDocuments'
import { useDocumentConcepts } from '@/hooks/useConcepts'
import { AiTutorChat } from '@/components/shared/AiTutorChat'
import { Skeleton } from '@/components/ui/skeleton'
import { StudyHeader } from './StudyHeader'
import { GuideTab } from './GuideTab'
import { ConceptsTab } from './ConceptsTab'
import { NotesTab } from './NotesTab'
import { FlashcardsTab } from './FlashcardsTab'
import { DocumentPane } from './DocumentPane'
import type { DocumentHighlight } from '@/hooks/useHighlights'
import { DocumentProcessingOverlay } from './DocumentProcessingOverlay'
import type { DocumentProcessingOverlayPhase } from '@/lib/documentProcessingOverlay'

function holdOverlayPhase(ms: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export function FileViewer() {
    const { id } = useParams<{ id: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedTab = searchParams.get('tab')
    const allowedTabs = new Set(['guide', 'concepts', 'flashcards', 'notes'])
    const activeTab = requestedTab && allowedTabs.has(requestedTab) ? requestedTab : 'guide'
    const [currentPage, setCurrentPage] = useState(1)
    const [highlightTarget, setHighlightTarget] = useState<{ type: 'pdf'; page: number } | { type: 'docx'; id: string } | null>(null)
    const [tutorPrompt, setTutorPrompt] = useState<string | null>(null)
    const [showMobileDoc, setShowMobileDoc] = useState(false)
    const [isDocFullscreen, setIsDocFullscreen] = useState(false)
    const [manualProcessingPhase, setManualProcessingPhase] = useState<DocumentProcessingOverlayPhase>("processing")
    const [showManualProcessingOverlay, setShowManualProcessingOverlay] = useState(false)

    const { data: document, isLoading: docLoading, error: docError, refetch: refetchDoc } = useDocument(id)
    const { data: concepts, isLoading: conceptsLoading } = useDocumentConcepts(id)
    const processDocument = useProcessDocument()

    const MIN_SKELETON_MS = 350
    const [showDocSkeleton, setShowDocSkeleton] = useState(false)
    const loadingSinceRef = useRef<number | null>(null)
    const skeletonTimeoutRef = useRef<number | null>(null)

    useEffect(() => {
        if (docError) {
            setShowDocSkeleton(false)
            loadingSinceRef.current = null
            if (skeletonTimeoutRef.current) {
                window.clearTimeout(skeletonTimeoutRef.current)
                skeletonTimeoutRef.current = null
            }
            return
        }

        if (docLoading) {
            loadingSinceRef.current = Date.now()
            setShowDocSkeleton(true)
            if (skeletonTimeoutRef.current) {
                window.clearTimeout(skeletonTimeoutRef.current)
                skeletonTimeoutRef.current = null
            }
            return
        }

        if (!showDocSkeleton) return

        const since = loadingSinceRef.current
        if (!since) {
            setShowDocSkeleton(false)
            return
        }

        const elapsed = Date.now() - since
        const remaining = Math.max(MIN_SKELETON_MS - elapsed, 0)

        if (skeletonTimeoutRef.current) {
            window.clearTimeout(skeletonTimeoutRef.current)
            skeletonTimeoutRef.current = null
        }

        skeletonTimeoutRef.current = window.setTimeout(() => {
            setShowDocSkeleton(false)
            loadingSinceRef.current = null
            skeletonTimeoutRef.current = null
        }, remaining)
    }, [docLoading, docError, showDocSkeleton])

    useEffect(() => {
        return () => {
            if (skeletonTimeoutRef.current) {
                window.clearTimeout(skeletonTimeoutRef.current)
                skeletonTimeoutRef.current = null
            }
        }
    }, [])

    const handlePageJump = (page: number) => {
        setCurrentPage(page)
    }

    const handleHighlightPress = (highlight: DocumentHighlight) => {
        if (highlight.selection_data?.type === 'pdf' && highlight.selection_data.page) {
            setCurrentPage(highlight.selection_data.page)
            setHighlightTarget({ type: 'pdf', page: highlight.selection_data.page })
            setShowMobileDoc(true)
            return
        }

        if (highlight.selection_data?.type === 'docx') {
            setHighlightTarget({ type: 'docx', id: highlight.id })
            setShowMobileDoc(true)
        }
    }

    const handleProcessDocument = async () => {
        if (!document) return

        setManualProcessingPhase("processing")
        setShowManualProcessingOverlay(true)

        try {
            await processDocument.mutateAsync(document.id)
            await refetchDoc()
            setManualProcessingPhase("finalizing")
            await holdOverlayPhase(500)
        } catch (processingError) {
            console.warn("[FileViewer] Manual processing did not finish cleanly", {
                documentId: document.id,
                error: processingError instanceof Error ? processingError.message : processingError,
            })
        } finally {
            setShowManualProcessingOverlay(false)
        }
    }

    // Loading state
    if (showDocSkeleton && !docError) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link to="/files">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted/80">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-64 rounded-md" />
                        <Skeleton className="h-4 w-40 rounded-md" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
                    <div className="lg:col-span-3 flex flex-col gap-6">
                        <div className="flex w-full overflow-hidden rounded-xl border border-border/50 bg-muted/30 p-1.5 gap-1">
                            <Skeleton className="h-10 flex-1 rounded-lg" />
                            <Skeleton className="h-10 flex-1 rounded-lg" />
                            <Skeleton className="h-10 flex-1 rounded-lg" />
                            <Skeleton className="h-10 flex-1 rounded-lg" />
                        </div>

                        <div className="space-y-5">
                            <div className="rounded-2xl border border-border/50 p-5 space-y-3">
                                <Skeleton className="h-4 w-24" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                    <Skeleton className="h-5 w-24 rounded-full" />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border/50 p-5 space-y-3">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-11/12" />
                                <Skeleton className="h-4 w-10/12" />
                            </div>

                            {Array.from({ length: 2 }).map((_, idx) => (
                                <div key={idx} className="rounded-2xl border border-border/50 p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-10 w-10 rounded-xl" />
                                            <Skeleton className="h-5 w-40" />
                                        </div>
                                        <Skeleton className="h-6 w-16 rounded-lg" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-11/12" />
                                        <Skeleton className="h-4 w-8/12" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <Card className="border-border/50 shadow-sm">
                            <CardContent className="p-0">
                                <div className="flex items-center justify-between border-b p-3">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-8 w-14 rounded-md" />
                                        <Skeleton className="h-4 w-8" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                    </div>
                                </div>
                                <div className="space-y-3 p-4">
                                    <Skeleton className="h-28 w-full rounded-xl" />
                                    <Skeleton className="h-28 w-full rounded-xl" />
                                    <Skeleton className="h-28 w-full rounded-xl" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        )
    }

    // Error state
    if (docError || !document) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link to="/files">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted/80">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">Document Not Found</h1>
                </div>
                <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-24 text-destructive">
                        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Could not load document</h3>
                        <p className="text-base text-muted-foreground mb-8 max-w-md text-center">
                            {docError instanceof Error ? docError.message : 'The document you are looking for might have been removed or is temporarily unavailable.'}
                        </p>
                        <Link to="/files">
                            <Button variant="outline" className="gap-2 bg-background hover:bg-muted">
                                <ArrowLeft className="w-4 h-4" />
                                Return to Files
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isPending = document.status === 'pending'
    const isProcessing = document.status === 'processing'

    return (
        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
            {showManualProcessingOverlay && (
                <DocumentProcessingOverlay
                    context="detail_manual"
                    phase={manualProcessingPhase}
                    documentTitle={document.title}
                />
            )}

            <StudyHeader
                document={document}
                refetchDoc={refetchDoc}
                onProcessDocument={handleProcessDocument}
                isProcessPending={processDocument.isPending}
            />

            {isPending && (
                <Card className="group relative overflow-hidden border-orange-200/50 bg-gradient-to-br from-orange-50/80 via-background to-amber-50/80 dark:border-orange-900/30 dark:from-orange-950/30 dark:via-background dark:to-amber-950/30 shadow-sm transition-all hover:shadow-md">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <CardContent className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-5">
                            <div className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/50 dark:to-amber-900/50 shadow-inner border border-orange-200/50 dark:border-orange-800/50">
                                <Sparkles className="h-7 w-7 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="text-xl font-semibold tracking-tight">Processing Required</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                                    Your file is ready to view. To unlock AI features like the Guide,
                                    Concepts, Flashcards, and Notes, you need to process it first.
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={handleProcessDocument}
                            disabled={processDocument.isPending}
                            className="gap-2 self-start sm:self-auto shadow-sm hover:shadow transition-all bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white border-0 rounded-xl"
                            size="lg"
                        >
                            {processDocument.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Brain className="w-5 h-5" />
                            )}
                            <span className="font-semibold">{processDocument.isPending ? 'Processing...' : 'Process Document'}</span>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Processing overlay */}
            {isProcessing && (
                <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 via-background to-background shadow-sm">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
                    <CardContent className="relative flex flex-col items-center justify-center py-24 text-center">
                        <div className="relative mb-8 group">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                            <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-inner rotate-3 transition-transform group-hover:rotate-6">
                                <Brain className="w-12 h-12 text-primary animate-pulse" />
                            </div>
                            <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-xl bg-background border shadow-xl flex items-center justify-center -rotate-3 transition-transform group-hover:-rotate-6">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Analyzing Your Document
                        </h3>
                        <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                            EduCoach is extracting key concepts, generating flashcards, and preparing your personalized study materials.
                        </p>
                        <div className="mt-8 flex items-center gap-3 text-sm font-medium text-muted-foreground bg-muted/50 px-5 py-2.5 rounded-full border border-border/50 shadow-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span>Updating automatically in a few moments...</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Mobile Document Toggle */}
            {document.status !== 'processing' && (
                <div className="lg:hidden flex justify-end">
                    <Button
                        variant="outline"
                        onClick={() => setShowMobileDoc(!showMobileDoc)}
                        className="gap-2 w-full sm:w-auto shadow-sm rounded-xl font-medium"
                    >
                        {showMobileDoc ? (
                            <>
                                <ArrowLeft className="w-4 h-4" />
                                Back to Study Material
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                View Document
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Two-pane layout */}
            <div className={`grid grid-cols-1 ${isDocFullscreen ? 'lg:grid-cols-1' : 'lg:grid-cols-5'} gap-6 lg:gap-8 transition-opacity duration-300`} style={isProcessing ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
                {/* Left pane: study content */}
                <div className={`${isDocFullscreen ? 'hidden' : 'lg:col-span-3'} flex flex-col gap-6 ${showMobileDoc ? 'hidden lg:flex' : 'flex'} transition-all duration-300`}>
                    <Tabs value={activeTab} onValueChange={(value) => {
                        const nextParams = new URLSearchParams(searchParams)
                        nextParams.set('tab', value)
                        setSearchParams(nextParams, { replace: true })
                    }} className="flex-1 flex flex-col">
                        <TabsList className="flex w-full overflow-x-auto justify-start no-scrollbar bg-muted/40 p-1.5 rounded-xl h-auto border border-border/50 shadow-sm backdrop-blur-sm">
                            <TabsTrigger 
                                value="guide" 
                                className="gap-2 text-sm whitespace-nowrap px-5 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary text-muted-foreground hover:text-foreground transition-all duration-300 data-[state=active]:scale-[1.01]"
                            >
                                <BookOpen className="w-4 h-4" />
                                <span className="font-medium">Guide</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="concepts" 
                                className="gap-2 text-sm whitespace-nowrap px-5 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary text-muted-foreground hover:text-foreground transition-all duration-300 data-[state=active]:scale-[1.01]"
                            >
                                <Brain className="w-4 h-4" />
                                <span className="font-medium">Concepts</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="flashcards" 
                                className="gap-2 text-sm whitespace-nowrap px-5 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary text-muted-foreground hover:text-foreground transition-all duration-300 data-[state=active]:scale-[1.01]"
                            >
                                <Layers className="w-4 h-4" />
                                <span className="font-medium">Flashcards</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="notes" 
                                className="gap-2 text-sm whitespace-nowrap px-5 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary text-muted-foreground hover:text-foreground transition-all duration-300 data-[state=active]:scale-[1.01]"
                            >
                                <StickyNote className="w-4 h-4" />
                                <span className="font-medium">Notes</span>
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 mt-6 relative">
                            <TabsContent value="guide" className="m-0 focus-visible:outline-none focus-visible:ring-0 animate-in fade-in-50 duration-300">
                                <GuideTab
                                    summary={document.summary}
                                    structuredSummary={document.structured_summary}
                                    concepts={concepts || []}
                                    onPageJump={handlePageJump}
                                    isLoading={conceptsLoading && !document.structured_summary && !document.summary}
                                />
                            </TabsContent>

                            <TabsContent value="concepts" className="m-0 focus-visible:outline-none focus-visible:ring-0 animate-in fade-in-50 duration-300">
                                <ConceptsTab
                                    concepts={concepts || []}
                                    isLoading={conceptsLoading}
                                    documentStatus={document.status}
                                    onPageJump={handlePageJump}
                                    onAskTutor={(prompt: string) => setTutorPrompt(prompt)}
                                    documentId={document.id}
                                    focusedConceptId={searchParams.get('concept') ?? undefined}
                                />
                            </TabsContent>

                            <TabsContent value="flashcards" className="m-0 focus-visible:outline-none focus-visible:ring-0 animate-in fade-in-50 duration-300">
                                <FlashcardsTab
                                    documentId={document.id}
                                    documentStatus={document.status}
                                />
                            </TabsContent>

                            <TabsContent value="notes" className="m-0 focus-visible:outline-none focus-visible:ring-0 animate-in fade-in-50 duration-300">
                                <NotesTab
                                    documentId={document.id}
                                    concepts={concepts || []}
                                    onHighlightPress={handleHighlightPress}
                                />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* Right pane: document viewer */}
                <div className={`${isDocFullscreen ? 'lg:col-span-1' : 'lg:col-span-2'} mt-6 lg:mt-0 ${showMobileDoc || isDocFullscreen ? 'block' : 'hidden lg:block'}`}>
                    <DocumentPane
                        document={document}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        highlightTarget={highlightTarget}
                        onHighlightTargetHandled={() => setHighlightTarget(null)}
                        isFullscreen={isDocFullscreen}
                        onToggleFullscreen={() => setIsDocFullscreen((prev) => !prev)}
                    />
                </div>
            </div>

            <AiTutorChat
                documentId={id}
                pendingPrompt={tutorPrompt}
                onPromptConsumed={() => setTutorPrompt(null)}
            />
        </div>
    )
}
