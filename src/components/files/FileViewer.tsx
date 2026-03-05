import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, Loader2, AlertCircle, BookOpen, Brain, Sparkles, StickyNote } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useDocument } from '@/hooks/useDocuments'
import { useDocumentConcepts } from '@/hooks/useConcepts'
import { AiTutorChat } from '@/components/shared/AiTutorChat'
import { StudyHeader } from './StudyHeader'
import { StudyPath } from './StudyPath'
import { GuideTab } from './GuideTab'
import { ConceptsTab } from './ConceptsTab'
import { QuizPrepTab } from './QuizPrepTab'
import { NotesTab } from './NotesTab'
import { DocumentPane } from './DocumentPane'

export function FileViewer() {
    const { id } = useParams<{ id: string }>()
    const [activeTab, setActiveTab] = useState('guide')
    const [currentPage, setCurrentPage] = useState(1)

    const { data: document, isLoading: docLoading, error: docError, refetch: refetchDoc } = useDocument(id)
    const { data: concepts, isLoading: conceptsLoading } = useDocumentConcepts(id)

    const handlePageJump = (page: number) => {
        setCurrentPage(page)
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

    return (
        <div className="space-y-6">
            <StudyHeader document={document} refetchDoc={refetchDoc} />

            {/* Two-pane layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left pane: study content */}
                <div className="lg:col-span-3 space-y-4">
                    {document.status === 'ready' && (
                        <StudyPath documentId={document.id} onSelectTab={setActiveTab} />
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="guide" className="gap-1.5 text-xs sm:text-sm">
                                <BookOpen className="w-3.5 h-3.5 hidden sm:inline" />
                                Guide
                            </TabsTrigger>
                            <TabsTrigger value="concepts" className="gap-1.5 text-xs sm:text-sm">
                                <Brain className="w-3.5 h-3.5 hidden sm:inline" />
                                Concepts
                            </TabsTrigger>
                            <TabsTrigger value="quiz-prep" className="gap-1.5 text-xs sm:text-sm">
                                <Sparkles className="w-3.5 h-3.5 hidden sm:inline" />
                                Quiz Prep
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="gap-1.5 text-xs sm:text-sm">
                                <StickyNote className="w-3.5 h-3.5 hidden sm:inline" />
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
                            />
                        </TabsContent>

                        <TabsContent value="quiz-prep" className="mt-4">
                            <QuizPrepTab
                                documentId={document.id}
                                concepts={concepts || []}
                                documentStatus={document.status}
                            />
                        </TabsContent>

                        <TabsContent value="notes" className="mt-4">
                            <NotesTab
                                documentId={document.id}
                                concepts={concepts || []}
                            />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right pane: document viewer (lg+ only) */}
                <div className="hidden lg:block lg:col-span-2">
                    <DocumentPane
                        document={document}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                </div>
            </div>

            <AiTutorChat documentId={id} />
        </div>
    )
}
