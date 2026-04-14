import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    ArrowLeft,
    Sparkles,
    Download,
    Loader2,
    AlertCircle,
    RefreshCw,
    Clock,
    CheckCircle2,
    ShieldCheck,
    Scissors,
    Wand2,
    Gauge,
    Layers,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Document } from '@/hooks/useDocuments'
import { useProcessDocument, useUpdateDocument } from '@/hooks/useDocuments'
import { useGenerateFlashcards } from '@/hooks/useFlashcards'
import { getFileUrl, formatFileSize } from '@/lib/storage'
import { GenerateQuizDialog } from './GenerateQuizDialog'
import { useScheduleDocumentGoalWindow, useDeactivateDocumentGoalWindowPlaceholders } from '@/hooks/useGoalWindowScheduling'


interface StudyHeaderProps {
    document: Document
    refetchDoc: () => void
}

const STATUS_MAP: Record<string, { icon: React.ElementType; color: string; label: string; animate?: boolean }> = {
    pending: { icon: Clock, color: 'text-orange-500', label: 'Pending' },
    processing: { icon: Loader2, color: 'text-blue-500', label: 'Processing...', animate: true },
    ready: { icon: CheckCircle2, color: 'text-green-500', label: 'Ready' },
    error: { icon: AlertCircle, color: 'text-red-500', label: 'Error' },
}

function QualityBadge({ processedBy }: { processedBy?: string | null }) {
    const config = processedBy === 'gemini'
        ? { icon: Wand2, label: 'Refined', color: 'text-purple-600 border-purple-300 bg-purple-50', tip: 'Rewritten for readability by AI, grounded to the source.' }
        : processedBy === 'pure_nlp'
            ? { icon: Scissors, label: 'Extractive', color: 'text-amber-600 border-amber-300 bg-amber-50', tip: 'Summary is based on direct sentence selection; may feel choppy.' }
            : { icon: ShieldCheck, label: 'Clean', color: 'text-green-600 border-green-300 bg-green-50', tip: 'Extracted text looks good; minimal cleanup needed.' }

    const Icon = config.icon
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="outline" className={`gap-1 text-xs ${config.color}`}>
                        <Icon className="w-3 h-3" />
                        {config.label}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent><p className="max-w-[200px] text-xs">{config.tip}</p></TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function ProcessingQualityBadge({ quality }: { quality: number }) {
    const pct = Math.round(quality * 100)
    const config = quality >= 0.7
        ? { color: 'text-green-600 border-green-300 bg-green-50', tip: `Quality: ${pct}%. Extracted study material looks comprehensive.` }
        : quality >= 0.4
            ? { color: 'text-amber-600 border-amber-300 bg-amber-50', tip: `Quality: ${pct}%. Some concepts may be missing. Consider refining with AI.` }
            : { color: 'text-red-600 border-red-300 bg-red-50', tip: `Quality: ${pct}%. Limited extraction. Refine with AI for better results.` }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="outline" className={`gap-1 text-xs ${config.color}`}>
                        <Gauge className="w-3 h-3" />
                        {pct}%
                    </Badge>
                </TooltipTrigger>
                <TooltipContent><p className="max-w-[220px] text-xs">{config.tip}</p></TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export function StudyHeader({ document, refetchDoc }: StudyHeaderProps) {
    const processDocument = useProcessDocument()
    const updateDocument = useUpdateDocument()
    const [downloadingUrl, setDownloadingUrl] = useState(false)
    const [quizDialogOpen, setQuizDialogOpen] = useState(false)
    const generateFlashcards = useGenerateFlashcards()
    const scheduleGoalWindow = useScheduleDocumentGoalWindow()
    const deactivatePlaceholders = useDeactivateDocumentGoalWindowPlaceholders()

    const handleGoalDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        updateDocument.mutate({
            documentId: document.id,
            updates: { exam_date: val ? new Date(val).toISOString() : null }
        }, {
            onSuccess: (updatedDoc) => {
                refetchDoc()
                if (updatedDoc?.exam_date) {
                    scheduleGoalWindow.mutate({
                        document: updatedDoc,
                        examDate: updatedDoc.exam_date,
                    })
                } else {
                    deactivatePlaceholders.mutate({ documentId: document.id })
                }
            }
        })
    }

    const status = STATUS_MAP[document.status] || STATUS_MAP.pending
    const StatusIcon = status.icon

    const handleProcess = () => {
        processDocument.mutate(document.id, { onSuccess: () => refetchDoc() })
    }

    const handleDownload = async () => {
        setDownloadingUrl(true)
        try {
            const { data } = await getFileUrl(document.file_path)
            if (data) window.open(data.signedUrl, '_blank')
        } finally {
            setDownloadingUrl(false)
        }
    }



    return (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b pb-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/files">
                        <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold">{document.title}</h1>
                            <Badge variant="outline" className={`gap-1 ${status.color}`}>
                                <StatusIcon className={`w-3 h-3 ${status.animate ? 'animate-spin' : ''}`} />
                                {status.label}
                            </Badge>
                            {document.status === 'ready' && <QualityBadge processedBy={document.processed_by} />}
                            {document.status === 'ready' && document.processing_quality != null && (
                                <ProcessingQualityBadge quality={document.processing_quality} />
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground text-sm mt-1">
                            <span>{document.file_name}</span>
                            <span>&middot;</span>
                            <span>{formatFileSize(document.file_size)}</span>
                            <span>&middot;</span>
                            <span>Uploaded {new Date(document.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">

                    <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-md border text-sm mr-2">
                        <Clock className="w-4 h-4 text-muted-foreground mr-1" />
                        <span className="text-muted-foreground">Study Goal:</span>
                        <input
                            type="date"
                            className="bg-transparent border-none border-b border-muted hover:border-primary outline-none text-sm w-[120px] cursor-pointer transition-colors"
                            value={document.exam_date ? new Date(document.exam_date).toISOString().split('T')[0] : ''}
                            onChange={handleGoalDateChange}
                            disabled={updateDocument.isPending}
                        />
                    </div>
                    <Button variant="outline" className="gap-2" onClick={handleDownload} disabled={downloadingUrl}>
                        {downloadingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Download
                    </Button>
                    {document.status === 'pending' && (
                        <Button className="gap-2" onClick={handleProcess} disabled={processDocument.isPending}>
                            {processDocument.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Process Document
                        </Button>
                    )}
                    {document.status === 'ready' && (
                        <>
                            {/* <Button
                                variant="outline"
                                className="gap-2"
                                onClick={handleRefine}
                                disabled={processDocument.isPending}
                            >
                                {processDocument.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Brain className="w-4 h-4" />
                                )}
                                Refine with Gemini
                            </Button> */}
                            <Button
                                className="gap-2"
                                onClick={() => setQuizDialogOpen(true)}
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate Quiz
                            </Button>
                            <Button
                                variant="outline"
                                className="gap-2"
                                disabled={generateFlashcards.isPending}
                                onClick={() => generateFlashcards.mutate(document.id)}
                            >
                                {generateFlashcards.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Layers className="w-4 h-4" />
                                )}
                                Generate Flashcards
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {document.status === 'error' && document.error_message && (
                <div className="mt-4 flex items-start gap-3 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <div>
                        <p className="font-medium text-destructive">Processing Failed</p>
                        <p className="text-sm text-muted-foreground mt-1">{document.error_message}</p>
                        <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={handleProcess} disabled={processDocument.isPending}>
                            <RefreshCw className="w-3 h-3" /> Retry
                        </Button>
                    </div>
                </div>
            )}

            <GenerateQuizDialog
                open={quizDialogOpen}
                onOpenChange={setQuizDialogOpen}
                documentId={document.id}
            />
        </div>
    )
}
