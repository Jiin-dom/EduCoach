import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft,
    Sparkles,
    Download,
    Loader2,
    AlertCircle,
    RefreshCw,
    Brain,
    BookOpen,
    Clock,
    CheckCircle2,
    ChevronDown,
    ChevronUp
} from "lucide-react"
import { AiTutorChat } from "@/components/shared/AiTutorChat"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useDocument, useProcessDocument } from "@/hooks/useDocuments"
import { useDocumentConcepts, getDifficultyColor, getImportanceColor, type Concept } from "@/hooks/useConcepts"
import { getFileUrl, formatFileSize } from "@/lib/storage"
import { useGenerateQuiz } from "@/hooks/useQuizzes"

const MOJIBAKE_REPLACEMENTS: Record<string, string> = {
    "â€™": "'",
    "â€œ": "\"",
    "â€�": "\"",
    "â€“": "-",
    "â€”": "-",
    "â€¢": "-",
    "â€¦": "...",
}

function cleanDisplayText(value: string): string {
    let text = value || ""
    Object.entries(MOJIBAKE_REPLACEMENTS).forEach(([bad, good]) => {
        text = text.replaceAll(bad, good)
    })
    return text.replace(/\s+/g, " ").trim()
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function splitIntoSentences(text: string): string[] {
    const normalized = cleanDisplayText(text)
    if (!normalized) return []

    const matches = normalized.match(/[^.!?]+[.!?]+/g)
    const sentences = matches ? [...matches] : []
    const remainder = normalized.replace(/[^.!?]+[.!?]+/g, "").trim()
    if (remainder) {
        sentences.push(remainder)
    }
    return sentences.map((s) => s.trim()).filter(Boolean)
}

function buildKeywordPool(concepts: Concept[] | undefined): string[] {
    if (!concepts || concepts.length === 0) return []

    const seen = new Set<string>()
    const pool: string[] = []

    for (const concept of concepts) {
        const candidates = [concept.name, ...(concept.keywords || [])]
        for (const raw of candidates) {
            const cleaned = cleanDisplayText(raw || "")
            if (!cleaned || cleaned.length < 3) continue
            const lower = cleaned.toLowerCase()
            if (lower.includes("http") || lower.includes("www")) continue
            if (seen.has(lower)) continue
            seen.add(lower)
            pool.push(cleaned)
            if (pool.length >= 15) return pool
        }
    }

    return pool
}

export function FileViewer() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set())
    const [_fileUrl, setFileUrl] = useState<string | null>(null)
    const [downloadingUrl, setDownloadingUrl] = useState(false)
    const [highlightKeywords, setHighlightKeywords] = useState(true)
    const [summaryView, setSummaryView] = useState<"paragraph" | "bullets">("paragraph")

    // Fetch document and concepts
    const { data: document, isLoading: docLoading, error: docError, refetch: refetchDoc } = useDocument(id)
    const { data: concepts, isLoading: conceptsLoading } = useDocumentConcepts(id)
    const processDocument = useProcessDocument()
    const generateQuiz = useGenerateQuiz()

    const keywordPool = useMemo(() => buildKeywordPool(concepts), [concepts])
    const sortedKeywords = useMemo(
        () => [...keywordPool].sort((a, b) => b.length - a.length),
        [keywordPool]
    )

    const renderTextWithHighlights = (text: string) => {
        const cleaned = cleanDisplayText(text)
        if (!highlightKeywords || sortedKeywords.length === 0) {
            return <span>{cleaned}</span>
        }

        let result = cleaned
        sortedKeywords.forEach((keyword) => {
            const escaped = escapeRegExp(keyword)
            const regex = new RegExp(`(${escaped})`, "gi")
            result = result.replace(regex, "|||$1|||")
        })

        const parts = result.split("|||")
        return (
            <>
                {parts.map((part, i) => {
                    const isKeyword = sortedKeywords.some(
                        (k) => k.toLowerCase() === part.toLowerCase()
                    )
                    return isKeyword ? (
                        <span
                            key={i}
                            className="bg-primary/15 text-primary px-1 rounded font-medium"
                        >
                            {part}
                        </span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                })}
            </>
        )
    }

    // Handle document processing
    const handleProcess = () => {
        if (id) {
            console.log('[FileViewer] ▶️ Processing requested', {
                documentId: id,
                processor: 'pure_nlp'
            })
            processDocument.mutate(id, {
                onSuccess: () => {
                    refetchDoc()
                }
            })
        }
    }

    const handleRefineWithGemini = () => {
        if (id) {
            console.log('[FileViewer] ✨ Gemini refinement requested', {
                documentId: id,
                processor: 'gemini'
            })
            processDocument.mutate(
                { documentId: id, processor: 'gemini' },
                {
                    onSuccess: () => {
                        refetchDoc()
                    }
                }
            )
        }
    }

    const handleGenerateQuiz = () => {
        if (id) {
            generateQuiz.mutate(
                { documentId: id, questionCount: 10, enhanceWithLlm: true },
                {
                    onSuccess: (data) => {
                        if (data?.quizId) {
                            navigate(`/quizzes/${data.quizId}`)
                        } else {
                            navigate('/quizzes')
                        }
                    },
                }
            )
        }
    }

    // Handle file download
    const handleDownload = async () => {
        if (!document) return

        setDownloadingUrl(true)
        try {
            const { data, error } = await getFileUrl(document.file_path)
            if (error) {
                console.error('Failed to get download URL:', error)
                return
            }
            if (data) {
                setFileUrl(data.signedUrl)
                window.open(data.signedUrl, '_blank')
            }
        } finally {
            setDownloadingUrl(false)
        }
    }

    // Toggle concept expansion
    const toggleConcept = (conceptId: string) => {
        setExpandedConcepts(prev => {
            const newSet = new Set(prev)
            if (newSet.has(conceptId)) {
                newSet.delete(conceptId)
            } else {
                newSet.add(conceptId)
            }
            return newSet
        })
    }

    // Get status display info
    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'pending':
                return { icon: Clock, color: 'text-orange-500', label: 'Pending Processing' }
            case 'processing':
                return { icon: Loader2, color: 'text-blue-500', label: 'Processing...', animate: true }
            case 'ready':
                return { icon: CheckCircle2, color: 'text-green-500', label: 'Ready' }
            case 'error':
                return { icon: AlertCircle, color: 'text-red-500', label: 'Error' }
            default:
                return { icon: Clock, color: 'text-gray-500', label: 'Unknown' }
        }
    }

    // Loading state
    if (docLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link to="/files">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div className="animate-pulse">
                        <div className="h-6 bg-muted rounded w-48 mb-2"></div>
                        <div className="h-4 bg-muted rounded w-32"></div>
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
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
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
                        <Link to="/files">
                            <Button variant="outline">Return to Files</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const statusInfo = getStatusInfo(document.status)
    const StatusIcon = statusInfo.icon

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/files">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">{document.title}</h1>
                            <Badge variant="outline" className={`gap-1 ${statusInfo.color}`}>
                                <StatusIcon className={`w-3 h-3 ${statusInfo.animate ? 'animate-spin' : ''}`} />
                                {statusInfo.label}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground text-sm mt-1">
                            <span>{document.file_name}</span>
                            <span>•</span>
                            <span>{formatFileSize(document.file_size)}</span>
                            <span>•</span>
                            <span>Uploaded {new Date(document.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="gap-2 bg-transparent"
                        onClick={handleDownload}
                        disabled={downloadingUrl}
                    >
                        {downloadingUrl ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        Download
                    </Button>
                    {document.status === 'pending' && (
                        <Button
                            className="gap-2"
                            onClick={handleProcess}
                            disabled={processDocument.isPending}
                        >
                            {processDocument.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            Process Document
                        </Button>
                    )}
                    {document.status === 'ready' && (
                        <>
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={handleRefineWithGemini}
                                disabled={processDocument.isPending}
                            >
                                {processDocument.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Brain className="w-4 h-4" />
                                )}
                                Refine with Gemini
                            </Button>
                            <Button
                                className="gap-2"
                                onClick={handleGenerateQuiz}
                                disabled={generateQuiz.isPending}
                            >
                                {generateQuiz.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4" />
                                )}
                                Generate Quiz
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Error message for failed processing */}
            {document.status === 'error' && document.error_message && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="flex items-start gap-3 pt-6">
                        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                        <div>
                            <p className="font-medium text-destructive">Processing Failed</p>
                            <p className="text-sm text-muted-foreground mt-1">{document.error_message}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 gap-2"
                                onClick={handleProcess}
                                disabled={processDocument.isPending}
                            >
                                <RefreshCw className="w-3 h-3" />
                                Retry Processing
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Section */}
            {document.summary && (
                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary" />
                                Document Summary
                            </CardTitle>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant={summaryView === "paragraph" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSummaryView("paragraph")}
                                    className="h-8"
                                >
                                    Paragraph
                                </Button>
                                <Button
                                    variant={summaryView === "bullets" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSummaryView("bullets")}
                                    className="h-8"
                                >
                                    Bullets
                                </Button>
                                <Button
                                    variant={highlightKeywords ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setHighlightKeywords((prev) => !prev)}
                                    className="h-8"
                                >
                                    Highlight Terms
                                </Button>
                            </div>
                        </div>
                        <CardDescription>
                            Cleaned and formatted for study readability.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {summaryView === "bullets" ? (
                            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                                {splitIntoSentences(document.summary).map((sentence, idx) => (
                                    <li key={idx} className="leading-relaxed">
                                        {renderTextWithHighlights(sentence)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="space-y-3 text-muted-foreground leading-relaxed">
                                {cleanDisplayText(document.summary)
                                    .split(/\n\n+/)
                                    .filter(Boolean)
                                    .map((para, idx) => (
                                        <p key={idx}>{renderTextWithHighlights(para)}</p>
                                    ))}
                            </div>
                        )}

                        {keywordPool.length > 0 && (
                            <div className="pt-2 border-t">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                    Key Terms
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {keywordPool.map((keyword) => (
                                        <Badge key={keyword} variant="secondary" className="text-xs">
                                            {keyword}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Concepts Section */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Brain className="w-5 h-5 text-primary" />
                                Extracted Concepts
                            </span>
                            {concepts && concepts.length > 0 && (
                                <Badge variant="secondary">{concepts.length} concepts</Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Key concepts and topics identified in this document
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {document.status === 'pending' ? (
                            <div className="text-center py-12">
                                <Clock className="w-12 h-12 mx-auto text-orange-400 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Document Pending Processing</h3>
                                <p className="text-muted-foreground mb-4">
                                    Click "Process Document" to extract concepts and generate a summary.
                                </p>
                                <Button onClick={handleProcess} disabled={processDocument.isPending} className="gap-2">
                                    {processDocument.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
                                    Process Now
                                </Button>
                            </div>
                        ) : document.status === 'processing' ? (
                            <div className="text-center py-12">
                                <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Processing Document...</h3>
                                <p className="text-muted-foreground">
                                    Extracting text, analyzing content, and identifying key concepts.
                                    This may take a minute.
                                </p>
                            </div>
                        ) : conceptsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            </div>
                        ) : concepts && concepts.length > 0 ? (
                            <div className="space-y-3">
                                {concepts.map((concept) => (
                                    <ConceptCard
                                        key={concept.id}
                                        concept={concept}
                                        isExpanded={expandedConcepts.has(concept.id)}
                                        onToggle={() => toggleConcept(concept.id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Concepts Found</h3>
                                <p className="text-muted-foreground">
                                    No concepts were extracted from this document.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Stats & Quick Actions */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Document Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">File Type</span>
                                <Badge variant="outline">{document.file_type.toUpperCase()}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Size</span>
                                <span className="font-medium">{formatFileSize(document.file_size)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Concepts</span>
                                <span className="font-medium">{document.concept_count || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant="outline" className={statusInfo.color}>
                                    {statusInfo.label}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    {document.status === 'ready' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button
                                    className="w-full gap-2"
                                    variant="default"
                                    onClick={handleGenerateQuiz}
                                    disabled={generateQuiz.isPending}
                                >
                                    {generateQuiz.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    Generate Quiz
                                </Button>
                                <Button className="w-full gap-2" variant="outline">
                                    <BookOpen className="w-4 h-4" />
                                    Create Flashcards
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* AI Tutor Chat */}
            <AiTutorChat />
        </div>
    )
}

// Concept Card Component
function ConceptCard({
    concept,
    isExpanded,
    onToggle
}: {
    concept: Concept
    isExpanded: boolean
    onToggle: () => void
}) {
    const safeName = cleanDisplayText(concept.name)
    const safeDescription = cleanDisplayText(concept.description || "")

    return (
        <div
            className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={onToggle}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        {/* Importance indicator */}
                        <div
                            className={`w-2 h-2 rounded-full ${getImportanceColor(concept.importance)}`}
                            title={`Importance: ${concept.importance}/10`}
                        />
                        <h4 className="font-semibold">{safeName}</h4>
                        {concept.difficulty_level && (
                            <Badge
                                variant="outline"
                                className={`text-xs ${getDifficultyColor(concept.difficulty_level)}`}
                            >
                                {concept.difficulty_level}
                            </Badge>
                        )}
                    </div>
                    {concept.category && (
                        <p className="text-xs text-muted-foreground mb-2">{concept.category}</p>
                    )}
                </div>
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                    ) : (
                        <ChevronDown className="w-4 h-4" />
                    )}
                </Button>
            </div>

            {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-3">
                    {safeDescription && (
                        <p className="text-sm text-muted-foreground">{safeDescription}</p>
                    )}
                    {concept.keywords && concept.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {concept.keywords
                                .map((keyword) => cleanDisplayText(keyword))
                                .filter(Boolean)
                                .map((keyword, idx) => (
                                    <Badge key={`${keyword}-${idx}`} variant="secondary" className="text-xs">
                                        {keyword}
                                    </Badge>
                                ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
