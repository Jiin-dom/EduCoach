import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Loader2,
    Plus,
    StickyNote,
    PencilLine,
    Copy,
    Trash2,
    Quote,
    BookOpen,
    Clock,
    CheckCircle2,
    Maximize2,
    Minimize2,
    X,
} from 'lucide-react'
import { useDocumentNotes, useAutoSaveNotes } from '@/hooks/useNotes'
import { useHighlights, type DocumentHighlight } from '@/hooks/useHighlights'
import type { Concept } from '@/hooks/useConcepts'
import { cleanDisplayText } from '@/lib/studyUtils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NotesTabProps {
    documentId: string
    concepts: Concept[]
    onHighlightPress?: (highlight: DocumentHighlight) => void
    exitStudyMode?: () => void
}

export function NotesTab({ documentId, concepts, onHighlightPress, exitStudyMode }: NotesTabProps) {
    const { data: savedNote, isLoading } = useDocumentNotes(documentId)
    const { data: highlights, isLoading: highlightsLoading } = useHighlights(documentId)
    const { debouncedSave, isSaving } = useAutoSaveNotes(documentId)
    const [content, setContent] = useState('')
    const [hasEdited, setHasEdited] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const displayContent = useMemo(
        () => (hasEdited ? content : (savedNote?.content ?? '')),
        [hasEdited, content, savedNote],
    )

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`)
            })
        } else {
            document.exitFullscreen()
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault()
                toggleFullscreen()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isFullscreen])

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        if (!hasEdited) setHasEdited(true)
        setContent(val)
        debouncedSave(val)
    }, [debouncedSave, hasEdited])

    const copyToClipboard = (text: string, label = 'Copied to clipboard') => {
        navigator.clipboard.writeText(text)
        toast.success(label)
    }

    const clearNote = () => {
        if (window.confirm('Are you sure you want to clear all your notes for this document?')) {
            setContent('')
            setHasEdited(true)
            debouncedSave('')
            toast.info('Notes cleared')
        }
    }

    const insertConcept = useCallback((name: string) => {
        const insertion = `[${name}]`
        const base = hasEdited ? content : (savedNote?.content ?? '')
        const updated = base ? `${base}\n${insertion}` : insertion
        if (!hasEdited) setHasEdited(true)
        setContent(updated)
        debouncedSave(updated)
        toast.success(`Linked: ${name}`)
    }, [debouncedSave, hasEdited, content, savedNote])

    const addToNotes = (text: string) => {
        const base = hasEdited ? content : (savedNote?.content ?? '')
        const updated = base ? `${base}\n\n> ${text}\n\n` : `> ${text}\n\n`
        if (!hasEdited) setHasEdited(true)
        setContent(updated)
        debouncedSave(updated)
        toast.success('Added to your notes')
    }

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

    const renderEditor = (isFocusMode = false) => (
        <div className={cn("space-y-3", isFocusMode ? "h-full flex flex-col" : "")}>
            {!isFocusMode && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <StickyNote className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold tracking-tight">Active Notes</h3>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Your personal study space</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full hover:bg-muted"
                        onClick={toggleFullscreen}
                        title="Focus Mode (Ctrl+F)"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                </div>
            )}

            <div className={cn(
                "relative group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all flex flex-col",
                isFocusMode ? "h-full border-none shadow-none bg-transparent focus-within:ring-0" : ""
            )}>
                <div className={cn(
                    "flex items-center justify-between border-b px-3 py-2 bg-muted/20",
                    isFocusMode ? "bg-transparent border-border/40 px-6 py-4" : ""
                )}>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-7 px-2 text-[11px] gap-1.5 hover:bg-background rounded-md font-semibold",
                                isFocusMode ? "h-9 px-4 text-xs bg-background/50" : ""
                            )}
                            onClick={() => copyToClipboard(displayContent, 'Notes copied to clipboard')}
                            disabled={!displayContent}
                        >
                            <Copy className={cn("w-3 h-3", isFocusMode ? "w-4 h-4" : "")} />
                            Copy
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-7 px-2 text-[11px] gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md font-semibold",
                                isFocusMode ? "h-9 px-4 text-xs hover:bg-destructive/5" : ""
                            )}
                            onClick={clearNote}
                            disabled={!displayContent}
                        >
                            <Trash2 className={cn("w-3 h-3", isFocusMode ? "w-4 h-4" : "")} />
                            Clear
                        </Button>
                    </div>
                    <div className="flex items-center gap-3">
                        {isSaving && (
                            <Badge variant="outline" className={cn(
                                "gap-1.5 text-[10px] border-none bg-orange-50 text-orange-600 animate-pulse font-bold px-2 py-0.5",
                                isFocusMode ? "text-xs px-3 py-1" : ""
                            )}>
                                <Loader2 className={cn("w-2.5 h-2.5 animate-spin", isFocusMode ? "w-3.5 h-3.5" : "")} />
                                SYNCING
                            </Badge>
                        )}
                        {!isSaving && displayContent && (
                            <Badge variant="outline" className={cn(
                                "gap-1.5 text-[10px] border-none bg-green-50 text-green-600 font-bold px-2 py-0.5",
                                isFocusMode ? "text-xs px-3 py-1" : ""
                            )}>
                                <CheckCircle2 className={cn("w-2.5 h-2.5", isFocusMode ? "w-3.5 h-3.5" : "")} />
                                SAVED
                            </Badge>
                        )}
                    </div>
                </div>

                <textarea
                    value={displayContent}
                    onChange={handleChange}
                    placeholder="Start typing your insights...&#10;&#10;💡 Pro-tip: Use the concept buttons below to link ideas. Your notes are saved automatically as you think."
                    className={cn(
                        "w-full p-5 bg-transparent text-sm leading-relaxed resize-none focus:outline-none custom-scrollbar",
                        isFocusMode ? "flex-1 text-lg p-10 md:p-16 max-w-4xl mx-auto leading-loose min-h-[500px]" : "min-h-[350px]"
                    )}
                />

                <div className={cn(
                    "px-4 py-2 text-[10px] text-muted-foreground border-t bg-muted/5 flex items-center justify-between",
                    isFocusMode ? "bg-transparent border-border/40 px-10 py-4 text-xs" : ""
                )}>
                    <span className="font-medium">{displayContent.length} characters</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Auto-saved as you think</span>
                </div>
            </div>
        </div>
    )

    const renderSidebar = (isFocusMode = false) => (
        <div className={cn("space-y-8", isFocusMode ? "p-8" : "")}>
            {concepts.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <div className="h-px flex-1 bg-border/40" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Insert Concepts</span>
                        <div className="h-px flex-1 bg-border/40" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {concepts.slice(0, isFocusMode ? 24 : 12).map((c) => (
                            <Button
                                key={c.id}
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-2 rounded-xl bg-background hover:bg-primary/5 hover:border-primary/20 transition-all hover:scale-[1.02]"
                                onClick={() => insertConcept(cleanDisplayText(c.name))}
                            >
                                <Plus className="w-3 h-3 text-primary/60" />
                                {cleanDisplayText(c.name)}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-5">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                            <Quote className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-sm font-bold tracking-tight">Saved Highlights</h3>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-2 py-0 h-5 text-[10px] font-bold">
                        {fileHighlights.length}
                    </Badge>
                </div>

                {fileHighlights.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {fileHighlights.map((hl) => (
                            <div
                                key={hl.id}
                                className="group relative flex flex-col gap-4 rounded-2xl border border-border/50 bg-card p-5 transition-all hover:shadow-md hover:border-primary/30 cursor-pointer overflow-hidden active:scale-[0.99]"
                                onClick={() => onHighlightPress?.(hl)}
                            >
                                <div
                                    className="absolute left-0 top-0 bottom-0 w-1"
                                    style={{ backgroundColor: hl.color || '#FDE047' }}
                                />

                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                        <div className="p-1 rounded bg-muted/50">
                                            <BookOpen className="w-3 h-3" />
                                        </div>
                                        <span>
                                            {hl.selection_data?.type === 'pdf'
                                                ? `Page ${hl.selection_data.page || 1}`
                                                : 'Document Clip'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-7 w-7 rounded-lg bg-background hover:bg-muted shadow-sm border border-border/40"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                copyToClipboard(hl.content, 'Highlight copied')
                                            }}
                                            title="Copy to clipboard"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary shadow-sm border border-primary/20"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                addToNotes(hl.content)
                                            }}
                                            title="Add to your notes"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <p className="text-sm leading-relaxed text-foreground italic font-medium line-clamp-4">
                                    "{hl.content}"
                                </p>

                                {hl.note && (
                                    <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3 border border-border/30">
                                        <PencilLine className="w-4 h-4 mt-0.5 text-primary shrink-0 opacity-70" />
                                        <p className="text-xs text-muted-foreground leading-relaxed italic">{hl.note}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 px-6 rounded-2xl border border-dashed border-border/60 bg-muted/10">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted/30 mb-4">
                            <Quote className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <h4 className="text-sm font-semibold text-muted-foreground">No highlights yet</h4>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] mx-auto">
                            Select text in the document viewer to save key passages here.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div
            ref={containerRef}
            className={cn(
                "animate-in fade-in slide-in-from-bottom-2 duration-500",
                isFullscreen ? "fixed inset-0 z-50 bg-background overflow-hidden flex flex-col" : "space-y-8 relative"
            )}
        >
            {isFullscreen ? (
                <>
                    <div className="flex items-center justify-between px-8 py-4 border-b bg-card/30 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                                <StickyNote className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold tracking-tight">Focus Mode</h2>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Referencing highlights while writing</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl gap-2 hover:bg-muted font-bold text-xs"
                                onClick={toggleFullscreen}
                            >
                                <Minimize2 className="w-4 h-4" />
                                Exit Focus
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                                onClick={() => {
                                    if (exitStudyMode) {
                                        exitStudyMode()
                                    } else {
                                        toggleFullscreen()
                                    }
                                }}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-[380px] border-r bg-muted/10 overflow-y-auto custom-scrollbar">
                            {renderSidebar(true)}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-b from-card/50 to-background p-6 md:p-10">
                            <div className="max-w-5xl mx-auto h-full">
                                {renderEditor(true)}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {renderEditor(false)}
                    {renderSidebar(false)}
                </>
            )}
        </div>
    )
}
