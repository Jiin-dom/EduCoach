import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, Upload, Trash2, Sparkles, FileText, File, Loader2, RefreshCw, AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import { FileUploadDialog } from "@/components/files/FileUploadDialog"
import { Link } from "react-router-dom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useDocuments, useDeleteDocument, useProcessDocument, type Document } from "@/hooks/useDocuments"
import { formatFileSize } from "@/lib/storage"
import { GenerateQuizDialog } from "@/components/files/GenerateQuizDialog"

export function FilesContent() {
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
    const [quizDialogOpen, setQuizDialogOpen] = useState(false)
    const [selectedDocForQuiz, setSelectedDocForQuiz] = useState<Document | null>(null)

    // React Query hooks
    const { data: documents, isLoading, error, refetch } = useDocuments()
    const deleteDocument = useDeleteDocument()
    const processDocument = useProcessDocument()

    const handleUploadComplete = () => {
        // Refetch documents after successful upload
        refetch()
    }

    const handleDelete = async (doc: Document) => {
        if (window.confirm(`Are you sure you want to delete "${doc.title}"?`)) {
            deleteDocument.mutate(doc)
        }
    }

    const handleProcess = (doc: Document) => {
        console.log('[FilesContent] ▶️ Processing requested', {
            documentId: doc.id,
            title: doc.title,
            processor: 'pure_nlp'
        })
        processDocument.mutate(doc.id)
    }

    const handleGenerateQuiz = (doc: Document) => {
        setSelectedDocForQuiz(doc)
        setQuizDialogOpen(true)
    }

    const getFileIcon = (type: string) => {
        if (type === "pdf") return <FileText className="w-5 h-5 text-red-500" />
        return <File className="w-5 h-5 text-blue-500" />
    }

    const getStatusBadge = (status: Document['status']) => {
        switch (status) {
            case 'pending':
                return (
                    <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300 bg-orange-50">
                        <Clock className="w-3 h-3" />
                        Pending
                    </Badge>
                )
            case 'processing':
                return (
                    <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300 bg-blue-50">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing
                    </Badge>
                )
            case 'ready':
                return (
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready
                    </Badge>
                )
            case 'error':
                return (
                    <Badge variant="outline" className="gap-1 text-red-600 border-red-300 bg-red-50">
                        <AlertCircle className="w-3 h-3" />
                        Error
                    </Badge>
                )
            default:
                return null
        }
    }

    // Loading state
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
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-muted-foreground">Loading your documents...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Error state
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

    const files = documents || []

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FolderOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Study Materials</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Manage and organize your learning resources</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => setUploadDialogOpen(true)} className="gap-2 flex-1 sm:flex-none">
                        <Upload className="w-4 h-4" />
                        Upload File
                    </Button>
                </div>
            </div>

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
                            <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
                                <Upload className="w-4 h-4" />
                                Upload Your First File
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                                >
                                    {/* Clickable area - navigates to file detail */}
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
                                                {getStatusBadge(file.status)}
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
                                            {file.status === 'error' && file.error_message && (
                                                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                                    {file.error_message}
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                    {/* Action buttons - separate from clickable area */}
                                    <div className="flex items-center gap-1 sm:gap-2 self-end sm:self-auto shrink-0 border-t pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto justify-end">

                                        {file.status === 'pending' && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-primary hover:text-primary"
                                                            onClick={() => handleProcess(file)}
                                                            disabled={processDocument.isPending}
                                                        >
                                                            <RefreshCw className={`w-4 h-4 ${processDocument.isPending ? 'animate-spin' : ''}`} />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Process document</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                        {file.status === 'error' && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-orange-600 hover:text-orange-700"
                                                            onClick={() => handleProcess(file)}
                                                            disabled={processDocument.isPending}
                                                        >
                                                            <RefreshCw className={`w-4 h-4 ${processDocument.isPending ? 'animate-spin' : ''}`} />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Retry processing (wait a few minutes if rate limited)</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                        {file.status === 'ready' && (
                                            <>
                                                {/* <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-primary hover:text-primary"
                                                                onClick={() => handleRefineWithGemini(file)}
                                                                disabled={processDocument.isPending}
                                                            >
                                                                <Brain className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Refine with Gemini</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider> */}
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
                                            </>
                                        )}

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(file)}
                                                        className="text-destructive hover:text-destructive"
                                                        disabled={deleteDocument.isPending}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Delete file</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <FileUploadDialog
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                onUploadComplete={handleUploadComplete}
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
        </div>
    )
}
