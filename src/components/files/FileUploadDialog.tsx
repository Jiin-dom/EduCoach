import { useState, useCallback, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle, CloudUpload, Database, Brain, Sparkles } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { uploadFile, validateFile, formatFileSize, getFileTypeFromMime, ALLOWED_FILE_TYPES } from "@/lib/storage"
import { supabase, ensureFreshSession } from "@/lib/supabase"
import { useProcessDocument } from "@/hooks/useDocuments"

interface FileUploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpload?: (file: File) => void
    onUploadComplete?: () => void
}

type UploadPhase =
    | 'idle'
    | 'uploading'
    | 'saving'
    | 'processing'
    | 'success'
    | 'error'

interface PipelineStep {
    key: UploadPhase
    label: string
    icon: React.ReactNode
    messages: string[]
}

const PIPELINE_STEPS: PipelineStep[] = [
    {
        key: 'uploading',
        label: 'Uploading',
        icon: <CloudUpload className="w-5 h-5" />,
        messages: [
            'Uploading your file to secure storage...',
            'Transferring document data...',
        ],
    },
    {
        key: 'saving',
        label: 'Saving',
        icon: <Database className="w-5 h-5" />,
        messages: [
            'Saving document metadata...',
            'Registering your study material...',
        ],
    },
    {
        key: 'processing',
        label: 'Analyzing',
        icon: <Brain className="w-5 h-5" />,
        messages: [
            'Extracting text from your document...',
            'Running NLP analysis on content...',
            'Identifying key concepts and topics...',
            'Building concept relationships...',
            'Generating study flashcards...',
            'Creating semantic embeddings...',
            'Almost there, finalizing your study material...',
        ],
    },
]

const PHASE_ORDER: UploadPhase[] = ['uploading', 'saving', 'processing']

function getStepIndex(phase: UploadPhase): number {
    return PHASE_ORDER.indexOf(phase)
}

export function FileUploadDialog({ open, onOpenChange, onUpload, onUploadComplete }: FileUploadDialogProps) {
    const { user } = useAuth()
    const processDocument = useProcessDocument()

    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [title, setTitle] = useState("")
    const [goalDate, setGoalDate] = useState("")
    const [dragActive, setDragActive] = useState(false)
    const [phase, setPhase] = useState<UploadPhase>('idle')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [rotatingMsg, setRotatingMsg] = useState("")
    const rotatingIndex = useRef(0)

    const isBusy = phase === 'uploading' || phase === 'saving' || phase === 'processing'

    // Rotate the sub-message within the current phase
    useEffect(() => {
        if (!isBusy) return

        const step = PIPELINE_STEPS.find(s => s.key === phase)
        if (!step) return

        rotatingIndex.current = 0
        setRotatingMsg(step.messages[0])

        if (step.messages.length <= 1) return

        const interval = setInterval(() => {
            rotatingIndex.current = (rotatingIndex.current + 1) % step.messages.length
            setRotatingMsg(step.messages[rotatingIndex.current])
        }, 4000)

        return () => clearInterval(interval)
    }, [phase, isBusy])

    const handleOpenChange = (newOpen: boolean) => {
        if (isBusy) return
        if (!newOpen) {
            setTimeout(() => {
                setSelectedFile(null)
                setTitle("")
                setGoalDate("")
                setPhase('idle')
                setErrorMessage(null)
            }, 200)
        }
        onOpenChange(newOpen)
    }

    const handleFileSelect = (file: File) => {
        console.log('[FileUpload] File selected:', file.name)
        const validationError = validateFile(file)
        if (validationError) {
            setErrorMessage(validationError)
            return
        }
        setSelectedFile(file)
        setErrorMessage(null)
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
        setTitle(nameWithoutExt)
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
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0])
        }
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!selectedFile || !user) return

        console.log('[FileUpload] Starting upload...', selectedFile.name)
        setPhase('uploading')
        setErrorMessage(null)

        try {
            // Phase 1: Upload to storage
            const { data: uploadData, error: uploadError } = await uploadFile(user.id, selectedFile)
            if (uploadError) throw uploadError
            if (!uploadData) throw new Error('Upload failed - no data returned')

            // Phase 2: Save metadata
            setPhase('saving')

            try {
                await Promise.race([
                    ensureFreshSession(),
                    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
                ])
            } catch { /* proceed regardless */ }

            const documentData = {
                user_id: user.id,
                title: title.trim() || selectedFile.name,
                file_name: selectedFile.name,
                file_path: uploadData.path,
                file_type: getFileTypeFromMime(selectedFile.type),
                file_size: selectedFile.size,
                status: 'pending',
                exam_date: goalDate || null,
            }

            const { data: insertedDoc, error: dbError } = await supabase
                .from('documents')
                .insert(documentData)
                .select()
                .single()

            if (dbError) throw new Error(dbError.message)
            if (!insertedDoc) throw new Error('Database insert failed - no document returned')

            // Phase 3: Trigger NLP processing
            setPhase('processing')

            try {
                await processDocument.mutateAsync(insertedDoc.id)
            } catch (processingError) {
                console.warn('[FileUpload] Processing continues in background:', processingError)
            }

            // Done
            setPhase('success')

            if (onUpload) onUpload(selectedFile)
            if (onUploadComplete) onUploadComplete()

            setTimeout(() => handleOpenChange(false), 2000)

        } catch (err) {
            console.error('[FileUpload] Upload failed:', err)
            setPhase('error')
            setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
        }
    }

    const handleRemoveFile = () => {
        setSelectedFile(null)
        setTitle("")
        setGoalDate("")
        setErrorMessage(null)
    }

    const allowedTypesText = Object.values(ALLOWED_FILE_TYPES).map(t => t.toUpperCase()).join(', ')

    const currentStepIdx = getStepIndex(phase)

    return (
        <>
            {/* Full-screen blocking overlay */}
            {isBusy && (
                <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" />
            )}

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent
                    className={`max-w-[calc(100vw-2rem)] sm:max-w-md w-full overflow-hidden ${isBusy ? 'z-[70]' : ''}`}
                    onPointerDownOutside={(e) => { if (isBusy) e.preventDefault() }}
                    onEscapeKeyDown={(e) => { if (isBusy) e.preventDefault() }}
                    onInteractOutside={(e) => { if (isBusy) e.preventDefault() }}
                >
                    {/* Hide close button while busy */}
                    {isBusy && (
                        <style>{`[data-dialog-close] { display: none !important; }`}</style>
                    )}

                    <DialogHeader className="min-w-0">
                        <DialogTitle className="pr-6 break-words text-left">
                            {isBusy ? 'Processing Your Document' : 'Upload Study Material'}
                        </DialogTitle>
                        <DialogDescription className="break-words text-left">
                            {isBusy
                                ? 'Please wait while EduCoach prepares your study material.'
                                : 'Upload your documents to generate AI-powered quizzes and study guides.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4 min-w-0 w-full">
                        {/* ── IDLE: Drop zone ── */}
                        {phase === 'idle' && !selectedFile && (
                            <div
                                className={`
                                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                    transition-colors duration-200
                                    ${dragActive
                                        ? 'border-primary bg-primary/5'
                                        : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'
                                    }
                                `}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById('file-upload')?.click()}
                            >
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".pdf,.docx,.txt,.md"
                                    className="hidden"
                                    onChange={handleInputChange}
                                />
                                <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-sm font-medium mb-1">
                                    Drag and drop your file here, or click to browse
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Supported: {allowedTypesText} (max 10MB)
                                </p>
                            </div>
                        )}

                        {/* ── IDLE: Selected file ── */}
                        {selectedFile && phase === 'idle' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/20 min-w-0 w-full">
                                    <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-primary shrink-0" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate text-sm" title={selectedFile.name}>{selectedFile.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {formatFileSize(selectedFile.size)} &bull; {getFileTypeFromMime(selectedFile.type).toUpperCase()}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                        onClick={handleRemoveFile}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Document Title</Label>
                                        <Input
                                            id="title"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Enter a title for this document"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            This will help you identify the document later
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="goalDate">Study Goal (Completion Date)</Label>
                                        <Input
                                            id="goalDate"
                                            type="date"
                                            value={goalDate}
                                            onChange={(e) => setGoalDate(e.target.value)}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Target date for completing this document.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── BUSY: Pipeline progress ── */}
                        {isBusy && (
                            <div className="py-4 space-y-6">
                                {/* Step indicators */}
                                <div className="space-y-3">
                                    {PIPELINE_STEPS.map((step, idx) => {
                                        const isActive = step.key === phase
                                        const isDone = currentStepIdx > idx
                                        return (
                                            <div key={step.key} className="flex items-center gap-3">
                                                <div className={`
                                                    w-9 h-9 rounded-full flex items-center justify-center shrink-0
                                                    transition-all duration-500
                                                    ${isDone
                                                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                                        : isActive
                                                            ? 'bg-primary/15 text-primary ring-2 ring-primary/30'
                                                            : 'bg-muted text-muted-foreground/40'
                                                    }
                                                `}>
                                                    {isDone ? (
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    ) : isActive ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        step.icon
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium transition-colors ${
                                                        isDone
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : isActive
                                                                ? 'text-foreground'
                                                                : 'text-muted-foreground/50'
                                                    }`}>
                                                        {step.label}
                                                        {isDone && ' — Done'}
                                                    </p>
                                                    {isActive && (
                                                        <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in duration-500">
                                                            {rotatingMsg}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Progress bar */}
                                <div className="space-y-1.5">
                                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                                            style={{
                                                width: `${((currentStepIdx + 1) / PIPELINE_STEPS.length) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground text-center">
                                        Step {currentStepIdx + 1} of {PIPELINE_STEPS.length} — Do not close this window
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── SUCCESS ── */}
                        {phase === 'success' && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                                    <Sparkles className="w-8 h-8 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="font-semibold text-green-600 dark:text-green-400 text-lg">
                                    Your study material is ready!
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Concepts, flashcards, and study guide have been generated.
                                </p>
                            </div>
                        )}

                        {/* ── ERROR ── */}
                        {phase === 'error' && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                                    <AlertCircle className="w-8 h-8 text-destructive" />
                                </div>
                                <p className="font-medium text-destructive">Upload Failed</p>
                                <p className="text-sm text-muted-foreground text-center mt-1">{errorMessage}</p>
                                <Button
                                    variant="outline"
                                    className="mt-4"
                                    onClick={() => {
                                        setPhase('idle')
                                        setErrorMessage(null)
                                    }}
                                >
                                    Try Again
                                </Button>
                            </div>
                        )}

                        {/* Validation error (idle state) */}
                        {errorMessage && phase === 'idle' && (
                            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {errorMessage}
                            </div>
                        )}
                    </div>

                    {/* Action buttons (idle only) */}
                    {phase === 'idle' && (
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={!selectedFile || !title.trim()}
                                className="gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Upload
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
