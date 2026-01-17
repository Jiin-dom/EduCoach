import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, Upload, Eye, Trash2, Sparkles, FileText, File } from "lucide-react"
import { FileUploadDialog } from "@/components/files/FileUploadDialog"
import { Link } from "react-router-dom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface StudyFile {
    id: string
    name: string
    type: string
    size: string
    uploadDate: string
    subject: string
}

export function FilesContent() {
    const [files, setFiles] = useState<StudyFile[]>([
        { id: "1", name: "Introduction to Algorithms.pdf", type: "PDF", size: "2.4 MB", uploadDate: "2024-01-15", subject: "Computer Science" },
        { id: "2", name: "Data Structures Notes.pdf", type: "PDF", size: "1.8 MB", uploadDate: "2024-01-14", subject: "Computer Science" },
        { id: "3", name: "Database Management.docx", type: "DOCX", size: "956 KB", uploadDate: "2024-01-13", subject: "Information Systems" },
        { id: "4", name: "Web Development Guide.pdf", type: "PDF", size: "3.2 MB", uploadDate: "2024-01-12", subject: "Web Development" },
    ])

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

    const handleUpload = (file: File) => {
        const newFile: StudyFile = {
            id: Date.now().toString(),
            name: file.name,
            type: file.name.split(".").pop()?.toUpperCase() || "FILE",
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            uploadDate: new Date().toISOString().split("T")[0],
            subject: "General",
        }
        setFiles([newFile, ...files])
        setUploadDialogOpen(false)
    }

    const handleDelete = (id: string) => {
        setFiles(files.filter((file) => file.id !== id))
    }

    const getFileIcon = (type: string) => {
        if (type === "PDF") return <FileText className="w-5 h-5 text-red-500" />
        return <File className="w-5 h-5 text-blue-500" />
    }

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
                <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Upload File
                </Button>
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
                                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        {getFileIcon(file.type)}
                                        <div className="flex-1">
                                            <h4 className="font-semibold">{file.name}</h4>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                                <span>{file.subject}</span>
                                                <span>•</span>
                                                <span>{file.size}</span>
                                                <span>•</span>
                                                <span>Uploaded {new Date(file.uploadDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Link to={`/files/${file.id}`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>View file</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-primary hover:text-primary">
                                                        <Sparkles className="w-4 h-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Generate quiz from this file</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(file.id)}
                                                        className="text-destructive hover:text-destructive"
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

            <FileUploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} onUpload={handleUpload} />
        </div>
    )
}
