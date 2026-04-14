import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { deleteFile, uploadFile, validateFile, formatFileSize, getFileTypeFromMime, ALLOWED_FILE_TYPES } from "@/lib/storage"
import { supabase, ensureFreshSession } from "@/lib/supabase"
import { useProcessDocument } from "@/hooks/useDocuments"
import { useScheduleDocumentGoalWindow } from "@/hooks/useGoalWindowScheduling"
import { getDefaultDocumentTitle, getUploadItemStatusLabel, getUploadProcessingMode, type UploadItemStatus } from "@/lib/documentBatchProcessing"
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react"

interface FileUploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpload?: (file: File) => void
    onUploadComplete?: () => void
}

type UploadPhase = "idle" | "uploading" | "complete"
interface UploadBatchItem {
    id: string
    file: File
    title: string
    status: UploadItemStatus
    errorMessage: string | null
    documentId: string | null
}

function makeUploadBatchItems(files: File[]): UploadBatchItem[] {
    return files.map((file, index) => {
        const validationError = validateFile(file)

        return {
            id: `${Date.now()}-${index}-${file.name}`,
            file,
            title: getDefaultDocumentTitle(file.name),
            status: validationError ? "error" : "ready",
            errorMessage: validationError,
            documentId: null,
        }
    })
}

export function FileUploadDialog({ open, onOpenChange, onUpload, onUploadComplete }: FileUploadDialogProps) {
    const { user } = useAuth()
    const processDocument = useProcessDocument()
    const scheduleGoalWindow = useScheduleDocumentGoalWindow()

    const [items, setItems] = useState<UploadBatchItem[]>([])
    const [dragActive, setDragActive] = useState(false)
    const [phase, setPhase] = useState<UploadPhase>("idle")
    const [singleTitle, setSingleTitle] = useState("")
    const [goalLabel, setGoalLabel] = useState("")
    const [goalDate, setGoalDate] = useState("")
    const previousSingleItemIdRef = useRef<string | null>(null)

    const isBusy = phase === "uploading"
    const isSingleSelection = items.length === 1
    const uploadableItems = useMemo(
        () => items.filter((item) => item.status === "ready"),
        [items],
    )
    const uploadedCount = useMemo(
        () => items.filter((item) => item.status === "uploaded").length,
        [items],
    )
    const failedCount = useMemo(
        () => items.filter((item) => item.status === "error").length,
        [items],
    )
    const uploadMode = useMemo(
        () => getUploadProcessingMode(items.length),
        [items.length],
    )

    useEffect(() => {
        if (!isSingleSelection) {
            previousSingleItemIdRef.current = null
            return
        }

        const [item] = items
        if (previousSingleItemIdRef.current !== item.id) {
            setSingleTitle(item.title)
            setGoalLabel("")
            setGoalDate("")
            previousSingleItemIdRef.current = item.id
        }
    }, [isSingleSelection, items])

    const resetState = () => {
        setItems([])
        setDragActive(false)
        setPhase("idle")
        setSingleTitle("")
        setGoalLabel("")
        setGoalDate("")
        previousSingleItemIdRef.current = null
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (isBusy) return
        if (!newOpen) {
            setTimeout(resetState, 200)
        }
        onOpenChange(newOpen)
    }

    const appendFiles = (files: File[]) => {
        if (files.length === 0) return

        setItems((current) => [...current, ...makeUploadBatchItems(files)])
    }

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files?.length) {
            appendFiles(Array.from(e.dataTransfer.files))
        }
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            appendFiles(Array.from(e.target.files))
            e.target.value = ""
        }
    }

    const handleRemoveItem = (itemId: string) => {
        if (isBusy) return
        setItems((current) => current.filter((item) => item.id !== itemId))
    }

    const handleSingleTitleChange = (value: string) => {
        setSingleTitle(value)
        setItems((current) =>
            current.length === 1
                ? current.map((item) => ({
                    ...item,
                    title: value,
                }))
                : current,
        )
    }

    const handleUpload = async () => {
        if (!user || uploadableItems.length === 0) return

        setPhase("uploading")

        let anyUploaded = false
        const shouldProcessImmediately =
            getUploadProcessingMode(items.length) === "process_immediately" && uploadableItems.length === 1

        for (const item of uploadableItems) {
            setItems((current) =>
                current.map((candidate) =>
                    candidate.id === item.id
                        ? { ...candidate, status: "uploading", errorMessage: null }
                        : candidate,
                ),
            )

            try {
                const { data: uploadData, error: uploadError } = await uploadFile(user.id, item.file)
                if (uploadError) throw uploadError
                if (!uploadData) throw new Error("Upload failed - no data returned")

                try {
                    await Promise.race([
                        ensureFreshSession(),
                        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
                    ])
                } catch {
                    // Proceed with the insert using the current session state.
                }

                const documentData = {
                    user_id: user.id,
                    title: shouldProcessImmediately ? singleTitle.trim() || item.file.name : item.title.trim() || item.file.name,
                    goal_label: shouldProcessImmediately ? goalLabel.trim() || null : null,
                    file_name: item.file.name,
                    file_path: uploadData.path,
                    file_type: getFileTypeFromMime(item.file.type),
                    file_size: item.file.size,
                    status: "pending" as const,
                    exam_date: shouldProcessImmediately && goalDate ? goalDate : null,
                }

                const { data: insertedDoc, error: dbError } = await supabase
                    .from("documents")
                    .insert(documentData)
                    .select()
                    .single()

                if (dbError || !insertedDoc) {
                    await deleteFile(uploadData.path)
                    throw new Error(dbError?.message || "Database insert failed")
                }

                if (shouldProcessImmediately) {
                    try {
                        await processDocument.mutateAsync(insertedDoc.id)

                        if (goalDate) {
                            try {
                                await scheduleGoalWindow.mutateAsync({
                                    document: {
                                        id: insertedDoc.id,
                                        exam_date: insertedDoc.exam_date ?? goalDate,
                                    },
                                    examDate: insertedDoc.exam_date ?? goalDate,
                                })
                            } catch (scheduleError) {
                                console.warn("[FileUploadDialog] Goal-window scheduling failed after single upload", {
                                    documentId: insertedDoc.id,
                                    error: scheduleError instanceof Error ? scheduleError.message : scheduleError,
                                })
                            }
                        }
                    } catch (processingError) {
                        console.warn("[FileUploadDialog] Single-file auto-processing did not finish cleanly", {
                            documentId: insertedDoc.id,
                            error: processingError instanceof Error ? processingError.message : processingError,
                        })
                    }
                }

                anyUploaded = true

                setItems((current) =>
                    current.map((candidate) =>
                        candidate.id === item.id
                            ? {
                                ...candidate,
                                status: "uploaded",
                                documentId: insertedDoc.id,
                                errorMessage: null,
                            }
                            : candidate,
                    ),
                )

                if (onUpload) {
                    onUpload(item.file)
                }
            } catch (error) {
                setItems((current) =>
                    current.map((candidate) =>
                        candidate.id === item.id
                            ? {
                                ...candidate,
                                status: "error",
                                errorMessage: error instanceof Error ? error.message : "Upload failed",
                            }
                            : candidate,
                    ),
                )
            }
        }

        if (anyUploaded) {
            onUploadComplete?.()
        }

        setPhase("complete")
    }

    const allowedTypesText = Object.values(ALLOWED_FILE_TYPES).map((type) => type.toUpperCase()).join(", ")

    return (
        <>
            {isBusy && (
                <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" />
            )}

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent
                    className={`max-w-[calc(100vw-2rem)] sm:max-w-2xl w-full overflow-hidden ${isBusy ? "z-[70]" : ""}`}
                    onPointerDownOutside={(e) => { if (isBusy) e.preventDefault() }}
                    onEscapeKeyDown={(e) => { if (isBusy) e.preventDefault() }}
                    onInteractOutside={(e) => { if (isBusy) e.preventDefault() }}
                >
                    {isBusy && (
                        <style>{`[data-dialog-close] { display: none !important; }`}</style>
                    )}

                    <DialogHeader className="min-w-0">
                        <DialogTitle className="pr-6 break-words text-left">
                            {phase === "uploading"
                                ? uploadMode === "process_immediately"
                                    ? "Uploading And Processing Study Material"
                                    : "Uploading Study Materials"
                                : isSingleSelection
                                    ? "Upload Study Material"
                                    : "Upload Study Materials"}
                        </DialogTitle>
                        <DialogDescription className="break-words text-left">
                            {phase === "uploading"
                                ? uploadMode === "process_immediately"
                                    ? "Uploading your file and starting processing automatically."
                                    : "Uploading files and creating pending documents in your library."
                                : isSingleSelection
                                    ? "Upload your document to generate AI-powered quizzes and study guides."
                                    : "Upload one file to start processing automatically. Uploading multiple files adds them as pending — you can process them from the Files page when ready."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4 min-w-0 w-full">
                        {items.length === 0 && phase === "idle" && (
                            <div
                                className={`
                                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                    transition-colors duration-200
                                    ${dragActive
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
                                    }
                                `}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById("bulk-file-upload")?.click()}
                            >
                                <input
                                    id="bulk-file-upload"
                                    type="file"
                                    multiple
                                    accept=".pdf,.docx,.txt,.md"
                                    className="hidden"
                                    onChange={handleInputChange}
                                />
                                <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-sm font-medium mb-1">
                                    Drag and drop files here, or click to browse
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Supported: {allowedTypesText} (max 10MB each)
                                </p>
                            </div>
                        )}

                        {items.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2 rounded-lg border bg-accent/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-medium">
                                            {items.length} file{items.length === 1 ? "" : "s"} selected
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {isSingleSelection
                                                ? "Add details now so this study material is easier to find and plan around later."
                                                : "Titles will default from filenames. You can rename files later from the library."}
                                        </p>
                                    </div>
                                    {!isBusy && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => document.getElementById("bulk-file-upload-more")?.click()}
                                        >
                                            Add More Files
                                        </Button>
                                    )}
                                    <input
                                        id="bulk-file-upload-more"
                                        type="file"
                                        multiple
                                        accept=".pdf,.docx,.txt,.md"
                                        className="hidden"
                                        onChange={handleInputChange}
                                    />
                                </div>

                                {isSingleSelection && (
                                    <div className="space-y-4 rounded-lg border bg-card p-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="single-file-title">Document Title</Label>
                                            <Input
                                                id="single-file-title"
                                                value={singleTitle}
                                                onChange={(event) => handleSingleTitleChange(event.target.value)}
                                                placeholder="Enter a document title"
                                                maxLength={120}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                This will help you identify the document later
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="single-file-goal-label">Study Goal Name (optional)</Label>
                                            <Input
                                                id="single-file-goal-label"
                                                value={goalLabel}
                                                onChange={(event) => setGoalLabel(event.target.value)}
                                                placeholder="e.g., Midterm review, Finish Chapter 4"
                                                maxLength={80}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="single-file-goal-date">Study Goal (Completion Date)</Label>
                                            <Input
                                                id="single-file-goal-date"
                                                type="date"
                                                value={goalDate}
                                                onChange={(event) => setGoalDate(event.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Target date for completing this document.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                                    {items.map((item) => {
                                        const isUploading = item.status === "uploading"
                                        const statusTone = item.status === "uploaded"
                                            ? "text-green-600 dark:text-green-400"
                                            : item.status === "error"
                                                ? "text-destructive"
                                                : isUploading
                                                    ? "text-primary"
                                                    : "text-muted-foreground"

                                        return (
                                            <div
                                                key={item.id}
                                                className="flex items-start gap-3 rounded-lg border bg-card p-3"
                                            >
                                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                                    {item.status === "uploaded" ? (
                                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                    ) : item.status === "error" ? (
                                                        <AlertCircle className="h-5 w-5 text-destructive" />
                                                    ) : item.status === "uploading" ? (
                                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                    ) : (
                                                        <FileText className="h-5 w-5 text-primary" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate text-sm font-medium" title={item.file.name}>
                                                            {item.file.name}
                                                        </p>
                                                        <span className={`text-xs font-medium ${statusTone}`}>
                                                            {getUploadItemStatusLabel(item.status, uploadMode)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {formatFileSize(item.file.size)} • {getFileTypeFromMime(item.file.type).toUpperCase()}
                                                    </p>
                                                    {item.errorMessage && (
                                                        <p className="mt-1 text-xs text-destructive">
                                                            {item.errorMessage}
                                                        </p>
                                                    )}
                                                </div>
                                                {!isBusy && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {phase === "complete" && items.length > 0 && (
                            <div className="rounded-lg border bg-primary/5 p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold">
                                            {uploadMode === "process_immediately" ? "Upload finished" : "Upload batch finished"}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {uploadMode === "process_immediately"
                                                ? `${uploadedCount} file uploaded. Processing started automatically and you can follow its status from the Files page.`
                                                : `${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded into your library as pending documents.`}
                                            {failedCount > 0 && ` ${failedCount} file${failedCount === 1 ? "" : "s"} still need attention.`}
                                        </p>
                                        {uploadMode === "defer_processing" && (
                                            <p className="text-xs text-muted-foreground">
                                                Files uploaded in bulk are queued to prevent system overload. Head to the Files page and click Process All when ready.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {phase !== "complete" && (
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isBusy}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={isBusy || uploadableItems.length === 0}
                                className="gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                {isBusy
                                    ? "Uploading..."
                                    : `Upload ${uploadableItems.length} File${uploadableItems.length === 1 ? "" : "s"}`}
                            </Button>
                        </div>
                    )}

                    {phase === "complete" && (
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={resetState}>
                                Upload Another Batch
                            </Button>
                            <Button onClick={() => handleOpenChange(false)}>
                                Done
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
