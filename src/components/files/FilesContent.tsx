import { useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown, FolderOpen, Upload, Trash2, Sparkles, FileText, File, Loader2, RefreshCw, AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import { FileUploadDialog } from "@/components/files/FileUploadDialog"
import { Link, useNavigate } from "react-router-dom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { BrandedLoader } from "@/components/ui/branded-loader"
import { useDocuments, useDeleteDocument, useProcessDocument, processDocumentRequest, type Document } from "@/hooks/useDocuments"
import { formatFileSize } from "@/lib/storage"
import { FREE_DOCUMENT_LIMIT, canUploadMoreDocuments } from "@/lib/subscription"
import { GenerateQuizDialog } from "@/components/files/GenerateQuizDialog"
import { supabase } from "@/lib/supabase"
import { getClientDocumentStatus, selectNextPendingDocuments, type ClientDocumentStatus } from "@/lib/documentBatchProcessing"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

type BatchProcessSummary = {
    mode: "running" | "complete"
    total: number
    started: number
    succeeded: number
    failed: number
    skipped: number
}

const BATCH_PROCESS_CONCURRENCY = 2
const BATCH_PROCESS_STAGGER_MS = 350

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function FilesContent() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
    const [quizDialogOpen, setQuizDialogOpen] = useState(false)
    const [selectedDocForQuiz, setSelectedDocForQuiz] = useState<Document | null>(null)
    const [docPendingDelete, setDocPendingDelete] = useState<Document | null>(null)
    const [claimedIds, setClaimedIds] = useState<string[]>([])
    const [activeIds, setActiveIds] = useState<string[]>([])
    const [batchSummary, setBatchSummary] = useState<BatchProcessSummary | null>(null)

    const batchQueueRef = useRef<string[]>([])
    const batchActiveIdsRef = useRef<string[]>([])
    const batchRunIdRef = useRef(0)
    const batchSummaryRef = useRef<BatchProcessSummary | null>(null)

    const { data: documents, isLoading, error, refetch } = useDocuments()
    const deleteDocument = useDeleteDocument()
    const processDocument = useProcessDocument()

    const files = documents || []
    const hasPremium = Boolean(profile?.has_premium_entitlement)
    const documentCount = files.length
    const canUpload = canUploadMoreDocuments(documentCount, hasPremium)
    const pendingCount = files.filter((file) => file.status === "pending").length
    const isBatchRunning = batchSummary?.mode === "running"
    const queuedCount = Math.max(claimedIds.length - activeIds.length, 0)

    const syncBatchState = () => {
        setClaimedIds([...new Set([...batchQueueRef.current, ...batchActiveIdsRef.current])])
        setActiveIds([...batchActiveIdsRef.current])
        setBatchSummary(batchSummaryRef.current ? { ...batchSummaryRef.current } : null)
    }

    const resetBatchState = () => {
        batchQueueRef.current = []
        batchActiveIdsRef.current = []
        batchSummaryRef.current = null
        syncBatchState()
    }

    const handleUploadComplete = async () => {
        if (batchSummaryRef.current?.mode !== "running") {
            resetBatchState()
        }
        await refetch()
    }

    const handleDelete = (doc: Document) => {
        const clientStatus = getClientDocumentStatus(doc, claimedIds, activeIds)

        if (clientStatus.key === "processing") {
            return
        }

        setDocPendingDelete(doc)
    }

    const handleConfirmDelete = () => {
        if (!docPendingDelete) return

        const clientStatus = getClientDocumentStatus(docPendingDelete, claimedIds, activeIds)

        if (clientStatus.key === "queued") {
            batchQueueRef.current = batchQueueRef.current.filter((queuedId) => queuedId !== docPendingDelete.id)
            if (batchSummaryRef.current?.mode === "running") {
                batchSummaryRef.current.total = Math.max(batchSummaryRef.current.total - 1, 0)
            }
            syncBatchState()
        }

        deleteDocument.mutate(docPendingDelete, {
            onSettled: () => setDocPendingDelete(null),
        })
    }

    const handleProcess = (doc: Document) => {
        const clientStatus = getClientDocumentStatus(doc, claimedIds, activeIds)
        if (clientStatus.key !== "pending") return

        console.log("[FilesContent] ▶️ Processing requested", {
            documentId: doc.id,
            title: doc.title,
            processor: "pure_nlp",
        })
        processDocument.mutate(doc.id)
    }

    const handleGenerateQuiz = (doc: Document) => {
        setSelectedDocForQuiz(doc)
        setQuizDialogOpen(true)
    }

    const runBatchWorker = async (runId: number) => {
        while (batchRunIdRef.current === runId) {
            const nextId = batchQueueRef.current.shift()
            if (!nextId) break

            syncBatchState()

            const { data: currentDoc, error: statusError } = await supabase
                .from("documents")
                .select("status")
                .eq("id", nextId)
                .single()

            if (statusError || !currentDoc || currentDoc.status !== "pending") {
                if (batchSummaryRef.current) {
                    batchSummaryRef.current.skipped += 1
                }
                syncBatchState()
                continue
            }

            batchActiveIdsRef.current = [...batchActiveIdsRef.current, nextId]
            if (batchSummaryRef.current) {
                batchSummaryRef.current.started += 1
            }
            syncBatchState()

            try {
                await processDocumentRequest(nextId)
                if (batchSummaryRef.current) {
                    batchSummaryRef.current.succeeded += 1
                }
            } catch (workerError) {
                console.error("[FilesContent] Batch processing failed", {
                    documentId: nextId,
                    error: workerError instanceof Error ? workerError.message : workerError,
                })
                if (batchSummaryRef.current) {
                    batchSummaryRef.current.failed += 1
                }
            } finally {
                batchActiveIdsRef.current = batchActiveIdsRef.current.filter((activeId) => activeId !== nextId)
                syncBatchState()
                await refetch()

                if (batchQueueRef.current.length > 0) {
                    await sleep(BATCH_PROCESS_STAGGER_MS)
                }
            }
        }
    }

    const handleProcessAllPending = async () => {
        if (isBatchRunning) return

        const latest = await refetch()
        const latestDocs = latest.data || []
        const pendingDocs = selectNextPendingDocuments(latestDocs, [], latestDocs.length)

        if (pendingDocs.length === 0) {
            batchSummaryRef.current = {
                mode: "complete",
                total: 0,
                started: 0,
                succeeded: 0,
                failed: 0,
                skipped: 0,
            }
            syncBatchState()
            return
        }

        batchRunIdRef.current += 1
        const runId = batchRunIdRef.current

        batchQueueRef.current = pendingDocs.map((doc) => doc.id)
        batchActiveIdsRef.current = []
        batchSummaryRef.current = {
            mode: "running",
            total: pendingDocs.length,
            started: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
        }
        syncBatchState()

        const workerCount = Math.min(BATCH_PROCESS_CONCURRENCY, pendingDocs.length)
        await Promise.all(Array.from({ length: workerCount }, () => runBatchWorker(runId)))

        if (batchRunIdRef.current !== runId || !batchSummaryRef.current) {
            return
        }

        batchSummaryRef.current = {
            ...batchSummaryRef.current,
            mode: "complete",
        }
        syncBatchState()
        await refetch()
    }

    const getFileIcon = (type: string) => {
        if (type === "pdf") return <FileText className="w-5 h-5 text-red-500" />
        return <File className="w-5 h-5 text-blue-500" />
    }

    const getStatusBadge = (status: ClientDocumentStatus) => {
        switch (status.key) {
            case "queued":
                return (
                    <Badge variant="outline" className="gap-1 text-violet-600 border-violet-300 bg-violet-50">
                        <Clock className="w-3 h-3" />
                        {status.label}
                    </Badge>
                )
            case "pending":
                return (
                    <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300 bg-orange-50">
                        <Clock className="w-3 h-3" />
                        {status.label}
                    </Badge>
                )
            case "processing":
                return (
                    <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300 bg-blue-50">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {status.label}
                    </Badge>
                )
            case "ready":
                return (
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50">
                        <CheckCircle2 className="w-3 h-3" />
                        {status.label}
                    </Badge>
                )
            case "error":
                return (
                    <Badge variant="outline" className="gap-1 text-red-600 border-red-300 bg-red-50">
                        <AlertCircle className="w-3 h-3" />
                        {status.label}
                    </Badge>
                )
            default:
                return null
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <FolderOpen className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Study Materials</h1>
                            <p className="text-muted-foreground">Manage and organize your learning resources</p>
                        </div>
                    </div>
                </div>
                <Card>
                    <CardContent className="flex items-center justify-center py-16">
                        <BrandedLoader message="Loading your documents..." size="md" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <FolderOpen className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Study Materials</h1>
                            <p className="text-muted-foreground">Manage and organize your learning resources</p>
                        </div>
                    </div>
                </div>
                <Card>
                    <CardContent className="flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-4 text-destructive">
                            <AlertCircle className="w-8 h-8" />
                            <p>Failed to load documents</p>
                            <Button variant="outline" onClick={() => refetch()} className="gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FolderOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Study Materials</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Single files process automatically. Bulk uploads are queued — click Process All when ready.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {!hasPremium && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {documentCount}/{FREE_DOCUMENT_LIMIT} files
                        </span>
                    )}
                    <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    {canUpload ? (
                        <Button
                            onClick={() => setUploadDialogOpen(true)}
                            className="gap-2 flex-1 sm:flex-none"
                            disabled={isBatchRunning}
                        >
                            <Upload className="w-4 h-4" />
                            Upload Files
                        </Button>
                    ) : (
                        <Button
                            onClick={() => navigate("/subscription")}
                            className="gap-2 flex-1 sm:flex-none"
                            variant="outline"
                        >
                            <Crown className="w-4 h-4" />
                            Upgrade to Upload More
                        </Button>
                    )}
                </div>
            </div>

            {(pendingCount > 0 || batchSummary) && (
                <Card className="border-primary/20">
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <CardTitle>Pending Processing</CardTitle>
                            <CardDescription>
                                {isBatchRunning
                                    ? `Processing ${activeIds.length} file${activeIds.length === 1 ? "" : "s"} now with ${queuedCount} still queued.`
                                    : `${pendingCount} file${pendingCount === 1 ? " was" : "s were"} uploaded in bulk and queued to prevent overload. Click Process All to start.`}
                            </CardDescription>
                        </div>
                        <Button
                            onClick={handleProcessAllPending}
                            disabled={isBatchRunning || pendingCount === 0}
                            className="gap-2"
                        >
                            {isBatchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Process All Pending
                        </Button>
                    </CardHeader>
                    {batchSummary && (
                        <CardContent className="pt-0">
                            <div className="rounded-lg bg-accent/30 p-4 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground">
                                    {batchSummary.mode === "running" ? "Batch processing in progress" : "Latest batch summary"}
                                </p>
                                <p className="mt-1">
                                    Total: {batchSummary.total} • Started: {batchSummary.started} • Ready: {batchSummary.succeeded} • Failed: {batchSummary.failed} • Skipped: {batchSummary.skipped}
                                </p>
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>All Files ({files.length})</CardTitle>
                    <CardDescription>View, manage, and generate quizzes from your uploaded materials</CardDescription>
                </CardHeader>
                <CardContent>
                    {files.length === 0 ? (
                        <div className="text-center py-12">
                            <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No files uploaded yet</h3>
                            <p className="text-muted-foreground mb-4">Upload your study materials to get started</p>
                            <Button onClick={() => setUploadDialogOpen(true)} className="gap-2" disabled={isBatchRunning}>
                                <Upload className="w-4 h-4" />
                                Upload Your First Files
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {files.map((file) => {
                                const clientStatus = getClientDocumentStatus(file, claimedIds, activeIds)

                                return (
                                    <div
                                        key={file.id}
                                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                                    >
                                        <Link
                                            to={`/files/${file.id}`}
                                            className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 cursor-pointer min-w-0 w-full"
                                        >
                                            <div className="mt-1 sm:mt-0 shrink-0">
                                                {getFileIcon(file.file_type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="font-semibold truncate max-w-full group-hover:text-primary transition-colors">{file.title}</h4>
                                                    {getStatusBadge(clientStatus)}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground mt-1">
                                                    <span className="truncate max-w-[150px] sm:max-w-[200px]">{file.file_name}</span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span className="shrink-0">{formatFileSize(file.file_size)}</span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span className="shrink-0 truncate">Uploaded {new Date(file.created_at).toLocaleDateString()}</span>
                                                    {file.concept_count > 0 && (
                                                        <>
                                                            <span className="hidden sm:inline">•</span>
                                                            <span className="text-primary shrink-0">{file.concept_count} concepts</span>
                                                        </>
                                                    )}
                                                    {file.deadline && (
                                                        <>
                                                            <span className="hidden sm:inline">•</span>
                                                            <span className="text-amber-600 dark:text-amber-500 shrink-0 font-medium">
                                                                Due {new Date(file.deadline).toLocaleDateString()}
                                                            </span>
                                                        </>
                                                    )}
                                                    {file.exam_date && (
                                                        <>
                                                            <span className="hidden sm:inline">•</span>
                                                            <span className="text-red-500 dark:text-red-400 shrink-0 font-medium whitespace-nowrap">
                                                                Exam {new Date(file.exam_date).toLocaleDateString()}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                {file.status === "error" && file.error_message && (
                                                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                                        {file.error_message}
                                                    </p>
                                                )}
                                            </div>
                                        </Link>
                                        <div className="flex items-center gap-1 sm:gap-2 self-end sm:self-auto shrink-0 border-t pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto justify-end">
                                            {clientStatus.key === "pending" && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-primary hover:text-primary"
                                                                onClick={() => handleProcess(file)}
                                                                disabled={processDocument.isPending || isBatchRunning}
                                                            >
                                                                <RefreshCw className={`w-4 h-4 ${processDocument.isPending ? "animate-spin" : ""}`} />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Process document</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}

                                            {file.status === "error" && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-orange-600 hover:text-orange-700"
                                                                onClick={() => handleProcess(file)}
                                                                disabled={processDocument.isPending || isBatchRunning}
                                                            >
                                                                <RefreshCw className={`w-4 h-4 ${processDocument.isPending ? "animate-spin" : ""}`} />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Retry processing</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}

                                            {file.status === "ready" && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-primary hover:text-primary"
                                                                onClick={() => handleGenerateQuiz(file)}
                                                            >
                                                                <Sparkles className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Generate quiz from this file</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(file)}
                                                            className="text-destructive hover:text-destructive"
                                                            disabled={deleteDocument.isPending || clientStatus.key === "processing"}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{clientStatus.key === "processing" ? "Processing documents cannot be deleted yet" : "Delete file"}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <FileUploadDialog
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                onUploadComplete={handleUploadComplete}
                documentCount={documentCount}
                hasPremiumEntitlement={hasPremium}
            />

            {selectedDocForQuiz && (
                <GenerateQuizDialog
                    open={quizDialogOpen}
                    onOpenChange={(open) => {
                        setQuizDialogOpen(open)
                        if (!open) {
                            setSelectedDocForQuiz(null)
                        }
                    }}
                    documentId={selectedDocForQuiz.id}
                />
            )}

            <Dialog
                open={!!docPendingDelete}
                onOpenChange={(open) => {
                    if (!open && !deleteDocument.isPending) {
                        setDocPendingDelete(null)
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete study material?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete
                            {docPendingDelete ? ` "${docPendingDelete.title}"` : " this file"} and all related data.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                        Related data that will also be deleted includes quizzes, quiz attempts, flashcards, extracted
                        concepts/chunks, adaptive learning-path tasks, and linked progress records for this file.
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDocPendingDelete(null)}
                            disabled={deleteDocument.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={deleteDocument.isPending}
                        >
                            {deleteDocument.isPending ? (
                                <>
                                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete File and Related Data"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
