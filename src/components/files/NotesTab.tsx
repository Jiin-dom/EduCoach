import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, Loader2, Plus, StickyNote } from 'lucide-react'
import { useDocumentNotes, useAutoSaveNotes } from '@/hooks/useNotes'
import type { Concept } from '@/hooks/useConcepts'
import { cleanDisplayText } from '@/lib/studyUtils'

interface NotesTabProps {
    documentId: string
    concepts: Concept[]
}

export function NotesTab({ documentId, concepts }: NotesTabProps) {
    const { data: savedNote, isLoading } = useDocumentNotes(documentId)
    const { debouncedSave, isSaving } = useAutoSaveNotes(documentId)
    const [content, setContent] = useState('')
    const [hasEdited, setHasEdited] = useState(false)
    const displayContent = useMemo(
        () => (hasEdited ? content : (savedNote?.content ?? '')),
        [hasEdited, content, savedNote],
    )

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        if (!hasEdited) setHasEdited(true)
        setContent(val)
        debouncedSave(val)
    }, [debouncedSave, hasEdited])

    const insertConcept = useCallback((name: string) => {
        const insertion = `[${name}]`
        const base = hasEdited ? content : (savedNote?.content ?? '')
        const updated = base ? `${base}\n${insertion}` : insertion
        if (!hasEdited) setHasEdited(true)
        setContent(updated)
        debouncedSave(updated)
    }, [debouncedSave, hasEdited, content, savedNote])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Study Notes</span>
                </div>
                <div className="flex items-center gap-2">
                    {isSaving && (
                        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Saving...
                        </Badge>
                    )}
                    {!isSaving && displayContent && (
                        <Badge variant="outline" className="gap-1 text-xs text-green-600">
                            <Save className="w-3 h-3" />
                            Saved
                        </Badge>
                    )}
                </div>
            </div>

            {/* Editor */}
            <textarea
                value={displayContent}
                onChange={handleChange}
                placeholder="Write your study notes here...&#10;&#10;Tips:&#10;- Summarize key takeaways in your own words&#10;- Use the 'Insert concept' button below to link concepts&#10;- Notes auto-save as you type"
                className="w-full min-h-[300px] p-4 rounded-lg border bg-background text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />

            {/* Insert concept */}
            {concepts.length > 0 && (
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">
                        Insert Concept
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {concepts.slice(0, 10).map((c) => (
                            <Button
                                key={c.id}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => insertConcept(cleanDisplayText(c.name))}
                            >
                                <Plus className="w-3 h-3" />
                                {cleanDisplayText(c.name)}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
