import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, Loader2, AlertCircle, BookOpen, Brain, Sparkles, StickyNote, Layers, FileText } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useDocument, useProcessDocument } from '@/hooks/useDocuments'
import { useDocumentConcepts } from '@/hooks/useConcepts'
import { AiTutorChat } from '@/components/shared/AiTutorChat'
import { StudyHeader } from './StudyHeader'
import { StudyPath } from './StudyPath'
import { GuideTab } from './GuideTab'
import { ConceptsTab } from './ConceptsTab'
import { QuizPrepTab } from './QuizPrepTab'
import { NotesTab } from './NotesTab'
import { FlashcardsTab } from './FlashcardsTab'
import { DocumentPane } from './DocumentPane'
import type { DocumentHighlight } from '@/hooks/useHighlights'

export function FileViewer() {
    const { id } = useParams<{ id: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedTab = searchParams.get('tab')
    const activeTab = requestedTab || 'guide'
    const [currentPage, setCurrentPage] = useState(1)
    const [highlightTarget, setHighlightTarget] = useState<{ type: 'pdf'; page: number } | { type: 'docx'; id: string } | null>(null)
    const [tutorPrompt, setTutorPrompt] = useState<string | null>(null)
    const [showMobileDoc, setShowMobileDoc] = useState(false)

    const { data: document, isLoading: docLoading, error: docError, refetch: refetchDoc } = useDocument(id)
    const { data: concepts, isLoading: conceptsLoading } = useDocumentConcepts(id)
    const processDocument = useProcessDocument()

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

    // Loading state
    if (docLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link to="/files">
                        <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <div className="animate-pulse">
                        <div className="h-6 bg-muted rounded w-48 mb-2" />
                        <div className="h-4 bg-muted rounded w-32" />
                    </div>
                </div>
                <Card>
                    <CardContent className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Error state
    if (docError || !document) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link to="/files">
                        <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Document Not Found</h1>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-destructive">
                        <AlertCircle className="w-12 h-12 mb-4" />
                        <p className="text-lg font-medium">Could not load document</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            {docError instanceof Error ? docError.message : 'Document not found'}
                        </p>
                        <Link to="/files"><Button variant="outline">Return to Files</Button></Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isPending = document.status === 'pending'
    const isProcessing = document.status === 'processing'

    return (
        <div className="space-y-6">
            <StudyHeader document={document} refetchDoc={refetchDoc} />

            {isPending && (
                <Card className="border-orange-200 bg-orange-50/70 dark:border-orange-900/40 dark:bg-orange-950/10">
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                                <Sparkles className="h-5 w-5 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold">Document Pending Processing</h3>
                                <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                                    Your file is uploaded and ready. You can preview the original document now while Guide,
                                    Concepts, Quiz Prep, Flashcards, and Notes stay unavailable until processing finishes.
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => processDocument.mutate(document.id)}
                            disabled={processDocument.isPending}
                            className="gap-2 self-start sm:self-auto"
                        >
                            {processDocument.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Brain className="w-4 h-4" />
                            )}
                            Process Document
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Processing overlay */}
            {isProcessing && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="relative mb-6">
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                                <Brain className="w-10 h-10 text-primary" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            </div>
                        </div>
                        <h3 className="text-lg font-semibold mb-1">Analyzing Your Document</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            EduCoach is extracting concepts, building flashcards, and
                            preparing your study material. This page will update automatically.
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Checking for updates every few seconds...
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
                        className="gap-2 w-full sm:w-auto"
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={isProcessing ? { opacity: 0.3, pointerEvents: 'none' } : undefined}>
                {/* Left pane: study content */}
                <div className={`lg:col-span-3 space-y-4 ${showMobileDoc ? 'hidden lg:block' : 'block'}`}>
                    {document.status === 'ready' && (
                        <StudyPath
                            documentId={document.id}
                            onSelectTab={(tab) => {
                                const nextParams = new URLSearchParams(searchParams)
                                nextParams.set('tab', tab)
                                setSearchParams(nextParams, { replace: true })
                            }}
                        />
                    )}

                    <Tabs value={activeTab} onValueChange={(value) => {
                        const nextParams = new URLSearchParams(searchParams)
                        nextParams.set('tab', value)
                        setSearchParams(nextParams, { replace: true })
                    }}>
                        <TabsList className="flex w-full overflow-x-auto justify-start no-scrollbar">
                            <TabsTrigger value="guide" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                                <BookOpen className="w-3.5 h-3.5" />
                                Guide
                            </TabsTrigger>
                            <TabsTrigger value="concepts" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                                <Brain className="w-3.5 h-3.5" />
                                Concepts
                            </TabsTrigger>
                            <TabsTrigger value="quiz-prep" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                                <Sparkles className="w-3.5 h-3.5" />
                                Quiz Prep
                            </TabsTrigger>
                            <TabsTrigger value="flashcards" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                                <Layers className="w-3.5 h-3.5" />
                                Flashcards
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                                <StickyNote className="w-3.5 h-3.5" />
                                Notes
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="guide" className="mt-4">
                            <GuideTab
                                summary={document.summary}
                                structuredSummary={document.structured_summary}
                                concepts={concepts || []}
                                onPageJump={handlePageJump}
                            />
                        </TabsContent>

                        <TabsContent value="concepts" className="mt-4">
                            <ConceptsTab
                                concepts={concepts || []}
                                isLoading={conceptsLoading}
                                documentStatus={document.status}
                                onPageJump={handlePageJump}
                                onAskTutor={(prompt: string) => setTutorPrompt(prompt)}
                                documentId={document.id}
                            />
                        </TabsContent>

                        <TabsContent value="quiz-prep" className="mt-4">
                            <QuizPrepTab
                                documentId={document.id}
                                concepts={concepts || []}
                                documentStatus={document.status}
                            />
                        </TabsContent>

                        <TabsContent value="flashcards" className="mt-4">
                            <FlashcardsTab
                                documentId={document.id}
                                documentStatus={document.status}
                            />
                        </TabsContent>

                        <TabsContent value="notes" className="mt-4">
                            <NotesTab
                                documentId={document.id}
                                concepts={concepts || []}
                                onHighlightPress={handleHighlightPress}
                            />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right pane: document viewer */}
                <div className={`lg:col-span-2 mt-6 lg:mt-0 ${showMobileDoc ? 'block' : 'hidden lg:block'}`}>
                    <DocumentPane
                        document={document}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        highlightTarget={highlightTarget}
                        onHighlightTargetHandled={() => setHighlightTarget(null)}
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
