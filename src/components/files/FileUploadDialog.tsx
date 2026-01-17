import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { uploadFile, validateFile, formatFileSize, getFileTypeFromMime, ALLOWED_FILE_TYPES } from "@/lib/storage"
import { supabase } from "@/lib/supabase"

interface FileUploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpload?: (file: File) => void // Legacy callback for backwards compatibility
    onUploadComplete?: () => void // New callback when upload is saved to DB
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export function FileUploadDialog({ open, onOpenChange, onUpload, onUploadComplete }: FileUploadDialogProps) {
    const { user } = useAuth()
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [title, setTitle] = useState("")
    const [dragActive, setDragActive] = useState(false)
    const [status, setStatus] = useState<UploadStatus>('idle')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Reset state when dialog closes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Reset state after a brief delay to avoid visual glitches
            setTimeout(() => {
                setSelectedFile(null)
                setTitle("")
                setStatus('idle')
                setErrorMessage(null)
            }, 200)
        }
        onOpenChange(newOpen)
    }

    // Handle file selection
    const handleFileSelect = (file: File) => {
        const validationError = validateFile(file)
        if (validationError) {
            setErrorMessage(validationError)
            return
        }

        setSelectedFile(file)
        setErrorMessage(null)
        
        // Auto-fill title from filename (without extension)
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
        setTitle(nameWithoutExt)
    }

    // Handle drag events
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }, [])

    // Handle drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0])
        }
    }, [])

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0])
        }
    }

    // Handle upload
    const handleUpload = async () => {
        if (!selectedFile || !user) return

        setStatus('uploading')
        setErrorMessage(null)

        try {
            // 1. Upload file to Supabase Storage
            const { data: uploadData, error: uploadError } = await uploadFile(user.id, selectedFile)
            
            if (uploadError) {
                throw uploadError
            }

            if (!uploadData) {
                throw new Error('Upload failed - no data returned')
            }

            // 2. Save document metadata to database
            const { error: dbError } = await supabase
                .from('documents')
                .insert({
                    user_id: user.id,
                    title: title.trim() || selectedFile.name,
                    file_name: selectedFile.name,
                    file_path: uploadData.path,
                    file_type: getFileTypeFromMime(selectedFile.type),
                    file_size: selectedFile.size,
                    status: 'pending', // Will be processed by Edge Function
                })

            if (dbError) {
                throw new Error(dbError.message)
            }

            // Success!
            setStatus('success')
            
            // Call legacy callback if provided
            if (onUpload) {
                onUpload(selectedFile)
            }

            // Call new callback
            if (onUploadComplete) {
                onUploadComplete()
            }

            // Close dialog after brief success state
            setTimeout(() => {
                handleOpenChange(false)
            }, 1500)

        } catch (err) {
            console.error('Upload error:', err)
            setStatus('error')
            setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
        }
    }

    // Remove selected file
    const handleRemoveFile = () => {
        setSelectedFile(null)
        setTitle("")
        setErrorMessage(null)
    }

    const allowedTypesText = Object.values(ALLOWED_FILE_TYPES).map(t => t.toUpperCase()).join(', ')

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Study Material</DialogTitle>
                    <DialogDescription>
                        Upload your documents to generate AI-powered quizzes and study guides.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Drop zone */}
                    {!selectedFile && (
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

                    {/* Selected file display */}
                    {selectedFile && status === 'idle' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/20">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{selectedFile.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatFileSize(selectedFile.size)} • {getFileTypeFromMime(selectedFile.type).toUpperCase()}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={handleRemoveFile}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

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
                        </div>
                    )}

                    {/* Uploading state */}
                    {status === 'uploading' && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                            <p className="font-medium">Uploading...</p>
                            <p className="text-sm text-muted-foreground">Please wait while we process your file</p>
                        </div>
                    )}

                    {/* Success state */}
                    {status === 'success' && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="font-medium text-green-600">Upload Complete!</p>
                            <p className="text-sm text-muted-foreground">Your document is being processed</p>
                        </div>
                    )}

                    {/* Error state */}
                    {status === 'error' && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                                <AlertCircle className="w-8 h-8 text-destructive" />
                            </div>
                            <p className="font-medium text-destructive">Upload Failed</p>
                            <p className="text-sm text-muted-foreground text-center">{errorMessage}</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => {
                                    setStatus('idle')
                                    setErrorMessage(null)
                                }}
                            >
                                Try Again
                            </Button>
                        </div>
                    )}

                    {/* Error message for validation */}
                    {errorMessage && status === 'idle' && (
                        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {errorMessage}
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                {status === 'idle' && (
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
    )
}

