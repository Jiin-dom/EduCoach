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
    BarChart3,
    FileText,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Document } from '@/hooks/useDocuments'
import { useUpdateDocument } from '@/hooks/useDocuments'
import { useGenerateFlashcards } from '@/hooks/useFlashcards'
import { getFileUrl, formatFileSize } from '@/lib/storage'
import { GenerateQuizDialog } from './GenerateQuizDialog'
import { useScheduleDocumentGoalWindow, useDeactivateDocumentGoalWindowPlaceholders } from '@/hooks/useGoalWindowScheduling'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'


interface StudyHeaderProps {
    document: Document
    refetchDoc: () => void
    onProcessDocument: () => void
    isProcessPending: boolean
}

const STATUS_MAP: Record<string, { icon: React.ElementType; color: string; bg: string; label: string; animate?: boolean }> = {
    pending: { icon: Clock, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', label: 'Pending' },
    processing: { icon: Loader2, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', label: 'Processing...', animate: true },
    ready: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30', label: 'Ready' },
    error: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', label: 'Error' },
}

function QualityBadge({ processedBy }: { processedBy?: string | null }) {
    const config = processedBy === 'gemini'
        ? { icon: Wand2, label: 'Refined', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900', tip: 'Rewritten for readability by AI, grounded to the source.' }
        : processedBy === 'pure_nlp'
            ? { icon: Scissors, label: 'Extractive', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900', tip: 'Summary is based on direct sentence selection; may feel choppy.' }
            : { icon: ShieldCheck, label: 'Clean', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900', tip: 'Extracted text looks good; minimal cleanup needed.' }

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
        ? { color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900', tip: `Quality: ${pct}%. Extracted study material looks comprehensive.` }
        : quality >= 0.4
            ? { color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900', tip: `Quality: ${pct}%. Some concepts may be missing. Consider refining with AI.` }
            : { color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900', tip: `Quality: ${pct}%. Limited extraction. Refine with AI for better results.` }

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

export function StudyHeader({ document, refetchDoc, onProcessDocument, isProcessPending }: StudyHeaderProps) {
    const updateDocument = useUpdateDocument()
    const [downloadingUrl, setDownloadingUrl] = useState(false)
    const [quizDialogOpen, setQuizDialogOpen] = useState(false)
    const generateFlashcards = useGenerateFlashcards()
    const scheduleGoalWindow = useScheduleDocumentGoalWindow()
    const deactivatePlaceholders = useDeactivateDocumentGoalWindowPlaceholders()

    const handleGoalDateChange = (date: Date | undefined) => {
        updateDocument.mutate({
            documentId: document.id,
            updates: { exam_date: date ? date.toISOString() : null }
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
        onProcessDocument()
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
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 border-b pb-4 mb-6 pt-3">
            <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-5">
                <div className="flex items-start gap-4">
                    <Link to="/files" className="mt-1">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted/60 text-muted-foreground transition-all w-9 h-9">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                {document.title}
                            </h1>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`gap-1.5 shadow-sm rounded-full px-2.5 py-0.5 border-border/40 font-semibold ${status.color} ${status.bg}`}>
                                    <StatusIcon className={`w-3.5 h-3.5 ${status.animate ? 'animate-spin' : ''}`} />
                                    <span>{status.label}</span>
                                </Badge>
                                {document.status === 'ready' && <QualityBadge processedBy={document.processed_by} />}
                                {document.status === 'ready' && document.processing_quality != null && (
                                    <ProcessingQualityBadge quality={document.processing_quality} />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 text-muted-foreground text-[13px] mt-0.5 font-medium">
                            <span className="truncate max-w-[200px] sm:max-w-[300px] flex items-center gap-1.5 text-foreground/80">
                                <FileText className="w-3.5 h-3.5 opacity-70" />
                                {document.file_name}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                            <span>{formatFileSize(document.file_size)}</span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                            <span>Uploaded {new Date(document.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap md:justify-end w-full md:w-auto mt-3 md:mt-0">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-9 gap-2 shadow-sm rounded-full font-medium hover:bg-muted/50 px-4 transition-all",
                                    !document.exam_date && "text-muted-foreground"
                                )}
                                disabled={updateDocument.isPending}
                            >
                                <CalendarIcon className="w-3.5 h-3.5 opacity-70" />
                                {document.exam_date ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="opacity-60 text-[10px] font-bold uppercase tracking-wider">Goal:</span>
                                        {format(new Date(document.exam_date), "PPP")}
                                    </span>
                                ) : (
                                    <span>Set Study Goal</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={document.exam_date ? new Date(document.exam_date) : undefined}
                                onSelect={handleGoalDateChange}
                                initialFocus
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            />
                        </PopoverContent>
                    </Popover>
                    {document.status === 'ready' && (
                        <Button variant="outline" className="gap-2 shadow-sm rounded-full font-medium hover:bg-muted/50 px-4" asChild>
                            <Link to={`/analytics/document/${document.id}`}>
                                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                                Analytics
                            </Link>
                        </Button>
                    )}
                    <Button variant="outline" className="gap-2 shadow-sm rounded-full font-medium hover:bg-muted/50 px-4" onClick={handleDownload} disabled={downloadingUrl}>
                        {downloadingUrl ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Download className="w-4 h-4 text-muted-foreground" />}
                        Download
                    </Button>
                    {document.status === 'pending' && (
                        <Button className="gap-2 shadow-sm rounded-full font-medium bg-primary hover:bg-primary/90 px-5" onClick={handleProcess} disabled={isProcessPending}>
                            {isProcessPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Process
                        </Button>
                    )}
                    {document.status === 'ready' && (
                        <>
                            <Button
                                className="gap-2 shadow-sm rounded-full font-medium bg-primary hover:bg-primary/90 text-primary-foreground px-5"
                                onClick={() => setQuizDialogOpen(true)}
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate Quiz
                            </Button>
                            <Button
                                variant="outline"
                                className="gap-2 shadow-sm rounded-full font-medium hover:bg-muted/50 px-4"
                                disabled={generateFlashcards.isPending}
                                onClick={() => generateFlashcards.mutate(document.id)}
                            >
                                {generateFlashcards.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                ) : (
                                    <Layers className="w-4 h-4 text-muted-foreground" />
                                )}
                                Flashcards
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {document.status === 'error' && document.error_message && (
                <div className="mt-5 flex items-start gap-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 shadow-sm">
                    <div className="p-2 rounded-full bg-destructive/10">
                        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    </div>
                    <div>
                        <p className="font-semibold text-destructive">Processing Failed</p>
                        <p className="text-sm text-destructive/80 mt-1 leading-relaxed">{document.error_message}</p>
                        <Button variant="outline" size="sm" className="mt-3 gap-2 bg-background shadow-sm hover:bg-muted" onClick={handleProcess} disabled={isProcessPending}>
                            <RefreshCw className="w-3.5 h-3.5" /> Retry Processing
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
