import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDocuments } from '@/hooks/useDocuments'
import { FileText, Search, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatFileSize } from '@/lib/storage'

interface SelectDocumentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (documentId: string) => void
}

export function SelectDocumentDialog({ open, onOpenChange, onSelect }: SelectDocumentDialogProps) {
    const { data: documents, isLoading, error } = useDocuments()
    const [searchQuery, setSearchQuery] = useState('')

    const readyDocuments = useMemo(() => {
        return (documents || []).filter(doc => doc.status === 'ready')
    }, [documents])

    const filteredDocuments = useMemo(() => {
        if (!searchQuery.trim()) return readyDocuments
        const query = searchQuery.toLowerCase()
        return readyDocuments.filter(doc => 
            doc.title.toLowerCase().includes(query) || 
            doc.file_name.toLowerCase().includes(query)
        )
    }, [readyDocuments, searchQuery])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Select a Document</DialogTitle>
                    <DialogDescription>
                        Choose a document to generate a new quiz from.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search documents..."
                            className="pl-9 h-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p className="text-sm">Loading documents...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-destructive">
                            <AlertCircle className="w-8 h-8 mb-2" />
                            <p className="text-sm">Failed to load documents</p>
                        </div>
                    ) : filteredDocuments.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">
                                {searchQuery ? 'No documents match your search' : 'No processed documents available'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredDocuments.map((doc) => (
                                <Button
                                    key={doc.id}
                                    variant="outline"
                                    onClick={() => onSelect(doc.id)}
                                    className="w-full flex items-center justify-start gap-3 p-3 h-auto rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-all text-left group"
                                >
                                    <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{doc.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-muted-foreground uppercase">{doc.file_type}</span>
                                            <span className="text-[10px] text-muted-foreground">•</span>
                                            <span className="text-[10px] text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                                        </div>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
