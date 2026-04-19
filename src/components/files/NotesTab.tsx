import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, Loader2, Plus, StickyNote, ChevronRight, PencilLine } from 'lucide-react'
import { useDocumentNotes, useAutoSaveNotes } from '@/hooks/useNotes'
import { useHighlights, type DocumentHighlight } from '@/hooks/useHighlights'
import type { Concept } from '@/hooks/useConcepts'
import { cleanDisplayText } from '@/lib/studyUtils'

interface NotesTabProps {
    documentId: string
    concepts: Concept[]
    onHighlightPress?: (highlight: DocumentHighlight) => void
}

export function NotesTab({ documentId, concepts, onHighlightPress }: NotesTabProps) {
    const { data: savedNote, isLoading } = useDocumentNotes(documentId)
    const { data: highlights, isLoading: highlightsLoading } = useHighlights(documentId)
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

    const fileHighlights = (highlights || []).filter(
        h => h.selection_data?.type === 'pdf' || h.selection_data?.type === 'docx'
    )

    if (isLoading || highlightsLoading) {
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

            {fileHighlights.length > 0 && (
                <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block">
                        Saved Highlights
                    </span>
                    <div className="space-y-2">
                        {fileHighlights.map((hl) => (
                            <button
                                key={hl.id}
                                type="button"
                                onClick={() => onHighlightPress?.(hl)}
                                className="w-full text-left rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/40 transition flex items-center gap-3"
                            >
                                <span
                                    className="h-10 w-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: hl.color || '#FDE047' }}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm italic truncate">"{hl.content}"</p>
                                    {hl.note ? (
                                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1 truncate">
                                            <PencilLine className="w-3 h-3 shrink-0" />
                                            {hl.note}
                                        </p>
                                    ) : null}
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {hl.selection_data?.type === 'pdf'
                                            ? `Page ${hl.selection_data?.page || 1}`
                                            : 'DOCX highlight'}
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
