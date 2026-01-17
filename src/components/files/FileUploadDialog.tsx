import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X, CalendarIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface FileUploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpload: (file: File) => void
}

export function FileUploadDialog({ open, onOpenChange, onUpload }: FileUploadDialogProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [showDeadlineModal, setShowDeadlineModal] = useState(false)
    const [hasDeadline, setHasDeadline] = useState(true)
    const [deadlineDate, setDeadlineDate] = useState("")
    const [deadlineTime, setDeadlineTime] = useState("")

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) {
            setSelectedFile(file)
        }
    }

    const handleUpload = () => {
        if (selectedFile) {
            setShowDeadlineModal(true)
        }
    }

    const handleFinalUpload = () => {
        if (selectedFile) {
            onUpload(selectedFile)
            setSelectedFile(null)
            setShowDeadlineModal(false)
            setHasDeadline(true)
            setDeadlineDate("")
            setDeadlineTime("")
        }
    }

    return (
        <>
            <Dialog open={open && !showDeadlineModal} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Upload Study Material</DialogTitle>
                        <DialogDescription>Upload PDFs, documents, or notes to generate personalized quizzes</DialogDescription>
                    </DialogHeader>

                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border"
                            }`}
                        onDragOver={(e) => {
                            e.preventDefault()
                            setIsDragging(true)
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        {selectedFile ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-medium text-sm">{selectedFile.name}</p>
                                        <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                                <Button onClick={handleUpload} className="w-full">
                                    Continue
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                    <Upload className="w-6 h-6 text-primary" />
                                </div>
                                <p className="font-medium mb-2">Drop your file here or click to browse</p>
                                <p className="text-sm text-muted-foreground mb-4">Supports PDF, DOC, DOCX, TXT files</p>
                                <input
                                    type="file"
                                    id="file-upload"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.txt"
                                    onChange={handleFileSelect}
                                />
                                <Button asChild variant="outline">
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        Select File
                                    </label>
                                </Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showDeadlineModal} onOpenChange={setShowDeadlineModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Set Deadline</DialogTitle>
                        <DialogDescription>
                            Do you have a deadline for this study material? Setting a deadline helps us create a better study plan.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="no-deadline"
                                checked={!hasDeadline}
                                onCheckedChange={(checked) => setHasDeadline(!checked)}
                            />
                            <Label htmlFor="no-deadline" className="text-sm font-normal cursor-pointer">
                                No deadline for this material
                            </Label>
                        </div>

                        {hasDeadline && (
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="deadline-date">Deadline Date</Label>
                                    <div className="relative">
                                        <Input
                                            id="deadline-date"
                                            type="date"
                                            value={deadlineDate}
                                            onChange={(e) => setDeadlineDate(e.target.value)}
                                            className="pl-10"
                                        />
                                        <CalendarIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="deadline-time">Deadline Time</Label>
                                    <Input
                                        id="deadline-time"
                                        type="time"
                                        value={deadlineTime}
                                        onChange={(e) => setDeadlineTime(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-4">
                            <Button variant="outline" onClick={() => setShowDeadlineModal(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button onClick={handleFinalUpload} className="flex-1">
                                Upload File
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
