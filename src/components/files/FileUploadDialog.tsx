import { useCallback, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { deleteFile, uploadFile, validateFile, formatFileSize, getFileTypeFromMime, ALLOWED_FILE_TYPES } from "@/lib/storage"
import { supabase, ensureFreshSession } from "@/lib/supabase"
import { getDefaultDocumentTitle } from "@/lib/documentBatchProcessing"
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react"

interface FileUploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpload?: (file: File) => void
    onUploadComplete?: () => void
}

type UploadPhase = "idle" | "uploading" | "complete"
type UploadItemStatus = "ready" | "uploading" | "uploaded" | "error"

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

    const [items, setItems] = useState<UploadBatchItem[]>([])
    const [dragActive, setDragActive] = useState(false)
    const [phase, setPhase] = useState<UploadPhase>("idle")

    const isBusy = phase === "uploading"
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

    const resetState = () => {
        setItems([])
        setDragActive(false)
        setPhase("idle")
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

    const handleUpload = async () => {
        if (!user || uploadableItems.length === 0) return

        setPhase("uploading")

        let anyUploaded = false

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
                    title: item.title.trim() || item.file.name,
                    file_name: item.file.name,
                    file_path: uploadData.path,
                    file_type: getFileTypeFromMime(item.file.type),
                    file_size: item.file.size,
                    status: "pending" as const,
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
                            {phase === "uploading" ? "Uploading Study Materials" : "Bulk Upload Study Materials"}
                        </DialogTitle>
                        <DialogDescription className="break-words text-left">
                            {phase === "uploading"
                                ? "Uploading files and creating pending documents in your library."
                                : "Upload multiple files now, then process the pending documents later when you are ready."}
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
                                            Titles will default from filenames. You can rename files later from the library.
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
                                                            {item.status === "ready"
                                                                ? "Ready to upload"
                                                                : item.status === "uploading"
                                                                    ? "Uploading..."
                                                                    : item.status === "uploaded"
                                                                        ? "Uploaded as pending"
                                                                        : "Needs attention"}
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
                                        <p className="text-sm font-semibold">Upload batch finished</p>
                                        <p className="text-sm text-muted-foreground">
                                            {uploadedCount} file{uploadedCount === 1 ? "" : "s"} uploaded into your library as pending documents.
                                            {failedCount > 0 && ` ${failedCount} file${failedCount === 1 ? "" : "s"} still need attention.`}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Processing does not start automatically. Use the Files page to process pending documents when you are ready.
                                        </p>
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
