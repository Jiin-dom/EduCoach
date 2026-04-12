import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Download,
    FileText,
    Loader2,
    AlertCircle,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Edit2,
    Highlighter
} from 'lucide-react'
import type { Document as DocType } from '@/hooks/useDocuments'
import type { Annotation } from '@/types/annotations'
import { getFileUrl, formatFileSize } from '@/lib/storage'
import { buildOfficePreviewUrl, getDocumentPreviewMode } from '@/lib/documentPreview'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentPaneProps {
    document: DocType
    currentPage: number
    onPageChange: (page: number) => void
}

export function DocumentPane({ document: doc, currentPage, onPageChange }: DocumentPaneProps) {
    const [signedUrl, setSignedUrl] = useState<string | null>(null)
    const [numPages, setNumPages] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [zoomOffset, setZoomOffset] = useState(0)
    const [containerWidth, setContainerWidth] = useState(0)
    const [pageInput, setPageInput] = useState(String(currentPage))

    // Edit & Annotation state
    const [isEditMode, setIsEditMode] = useState(false)
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number } | null>(null)
    const [selectedText, setSelectedText] = useState('')
    const [noteInput, setNoteInput] = useState('')
    const [highlightColor, setHighlightColor] = useState('#fef08a') // default yellow
    // Percentage rects for the new annotation
    const [pendingRects, setPendingRects] = useState<{x: number, y: number, width: number, height: number}[] | null>(null)
    const [pendingPage, setPendingPage] = useState(1)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
    // Tracks the page number last reported by the observer, so we can
    // distinguish "parent changed page externally" from "observer updated it".
    const lastObserverPage = useRef(currentPage)

    const previewMode = getDocumentPreviewMode(doc.file_type)
    const isPdf = previewMode === 'pdf'
    const officePreviewUrl = useMemo(() => {
        if (previewMode !== 'office' || !signedUrl) return null
        return buildOfficePreviewUrl(signedUrl)
    }, [previewMode, signedUrl])

    // Auto-fit: measure container width with ResizeObserver
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width
                if (w > 0) setContainerWidth(w - 16)
            }
        })
        ro.observe(container)
        return () => ro.disconnect()
    }, [])

    // Fetch signed URL
    useEffect(() => {
        if (previewMode === 'download') {
            setSignedUrl(null)
            setLoading(false)
            setError(null)
            return
        }
        let cancelled = false

        const fetchUrl = async () => {
            setLoading(true)
            setError(null)
            setSignedUrl(null)
            const { data, error: err } = await getFileUrl(doc.file_path)
            if (cancelled) return
            if (err || !data) {
                setError(isPdf ? 'Could not load PDF' : 'Could not load document preview')
                setLoading(false)
                return
            }
            setSignedUrl(data.signedUrl)
            if (!isPdf) {
                setLoading(false)
            }
        }

        fetchUrl()
        return () => { cancelled = true }
    }, [doc.file_path, isPdf, previewMode])

    useEffect(() => { setPageInput(String(currentPage)) }, [currentPage])

    const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
        setNumPages(n)
        setLoading(false)
    }, [])

    // Track which page is visible via IntersectionObserver.
    // Only updates the page indicator — never triggers scrolling.
    useEffect(() => {
        if (numPages === 0 || !scrollContainerRef.current) return

        const observer = new IntersectionObserver(
            (entries) => {
                let bestPage = lastObserverPage.current
                let bestRatio = 0
                for (const entry of entries) {
                    const pageNum = Number(entry.target.getAttribute('data-page'))
                    if (entry.intersectionRatio > bestRatio) {
                        bestRatio = entry.intersectionRatio
                        bestPage = pageNum
                    }
                }
                if (bestRatio > 0.1 && bestPage !== lastObserverPage.current) {
                    lastObserverPage.current = bestPage
                    onPageChange(bestPage)
                }
            },
            { root: scrollContainerRef.current, threshold: [0.25, 0.5] }
        )

        pageRefs.current.forEach((el) => observer.observe(el))
        return () => observer.disconnect()
    }, [numPages, onPageChange])

    // Programmatic scroll: only fires when currentPage differs from what the
    // observer last reported (meaning it came from an external source like a
    // source-chip click or page-number input — NOT from the observer itself).
    useEffect(() => {
        if (currentPage === lastObserverPage.current) return

        const el = pageRefs.current.get(currentPage)
        if (!el || !scrollContainerRef.current) return

        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        lastObserverPage.current = currentPage
    }, [currentPage])

    const goToPage = useCallback((p: number) => {
        const clamped = Math.max(1, Math.min(p, numPages || 1))
        onPageChange(clamped)

        const el = pageRefs.current.get(clamped)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            lastObserverPage.current = clamped
        }
    }, [numPages, onPageChange])

    const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const val = parseInt(pageInput, 10)
            if (!isNaN(val)) goToPage(val)
        }
    }

    const setPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
        if (el) pageRefs.current.set(page, el)
        else pageRefs.current.delete(page)
    }, [])

    const handleDownload = async () => {
        const { data } = await getFileUrl(doc.file_path)
        if (data) window.open(data.signedUrl, '_blank')
    }

    // Prevent scroll events inside the PDF viewer from reaching the page
    const handleWheel = useCallback((e: React.WheelEvent) => {
        const container = scrollContainerRef.current
        if (!container) return

        const { scrollTop, scrollHeight, clientHeight } = container
        const atTop = scrollTop <= 0 && e.deltaY < 0
        const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0

        // Only stop propagation if we're NOT at the boundary, so the viewer
        // consumes the scroll. At boundaries, let it pass through naturally.
        if (!atTop && !atBottom) {
            e.stopPropagation()
        }
    }, [])

    const handleMouseUp = () => {
        if (!isEditMode) return
        
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0 && selection.toString().trim().length > 0) {
            const range = selection.getRangeAt(0)
            const clientRects = range.getClientRects()
            const container = scrollContainerRef.current
            const pageEl = pageRefs.current.get(lastObserverPage.current)
            
            if (container && pageEl && clientRects.length > 0) {
                const containerRect = container.getBoundingClientRect()
                const pageRect = pageEl.getBoundingClientRect()
                
                // Grab the first rect for the popup position
                const firstRect = clientRects[0]
                
                // Ensure selection is inside the container
                if (firstRect.x >= containerRect.x && firstRect.x <= containerRect.right &&
                    firstRect.y >= containerRect.y && firstRect.y <= containerRect.bottom) {
                    
                    setSelectionRect({
                        x: firstRect.x - containerRect.x + container.scrollLeft + firstRect.width / 2,
                        y: firstRect.y - containerRect.y + container.scrollTop - 40
                    })
                    setSelectedText(selection.toString().trim())
                    
                    // Calculate relative percentages to the Page Element
                    const percentages = Array.from(clientRects).map(rect => ({
                        x: ((rect.x - pageRect.x) / pageRect.width) * 100,
                        y: ((rect.y - pageRect.y) / pageRect.height) * 100,
                        width: (rect.width / pageRect.width) * 100,
                        height: (rect.height / pageRect.height) * 100,
                    }))
                    setPendingRects(percentages)
                    setPendingPage(lastObserverPage.current)
                }
            }
        } else if (selectionRect && selection?.toString().trim().length === 0) {
            setSelectionRect(null)
            setNoteInput('')
            setPendingRects(null)
        }
    }

    const saveAnnotation = () => {
        if (!selectedText || !pendingRects) return
        const newAnn: Annotation = {
            id: crypto.randomUUID(),
            text: selectedText,
            note: noteInput,
            color: highlightColor,
            page: pendingPage,
            rects: pendingRects,
            createdAt: Date.now()
        }
        setAnnotations(prev => [...prev, newAnn])
        setSelectionRect(null)
        setNoteInput('')
        setSelectedText('')
        setPendingRects(null)
        window.getSelection()?.removeAllRanges()
    }

    const toggleEditMode = () => {
        setIsEditMode(prev => {
            const next = !prev
            if (!next) {
                setSelectionRect(null)
                setPendingRects(null)
                window.getSelection()?.removeAllRanges()
            }
            return next
        })
    }

    // Compute the width to pass to <Page>. Base = container width (auto-fit),
    // then apply zoom offset as a percentage adjustment.
    const pageWidth = containerWidth > 0 ? Math.round(containerWidth * (1 + zoomOffset * 0.15)) : undefined

    if (previewMode === 'download') {
        return (
            <Card className="sticky top-32">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Document Info
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">File</span>
                            <span className="font-medium truncate ml-4">{doc.file_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <Badge variant="outline">{doc.file_type.toUpperCase()}</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Size</span>
                            <span>{formatFileSize(doc.file_size)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Concepts</span>
                            <span>{doc.concept_count || 0}</span>
                        </div>
                    </div>
                    <Button variant="outline" className="w-full gap-2" onClick={handleDownload}>
                        <Download className="w-4 h-4" /> Download Original
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (previewMode === 'office') {
        return (
            <div
                className="sticky top-32 flex flex-col border rounded-lg bg-muted/30 overflow-hidden"
                style={{ height: 'calc(100vh - 160px)', maxHeight: 'calc(100vh - 160px)' }}
            >
                <div className="flex items-center justify-between gap-3 p-3 border-b bg-background">
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">DOCX Preview</p>
                        <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    </div>
                    <Button variant="outline" className="gap-2 shrink-0" onClick={handleDownload}>
                        <Download className="w-4 h-4" />
                        Open Original
                    </Button>
                </div>

                <div className="flex-1 min-h-0 bg-background">
                    {loading && !officePreviewUrl && (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}
                    {error && (
                        <div className="flex flex-col items-center justify-center h-full px-6 text-destructive">
                            <AlertCircle className="w-8 h-8 mb-2" />
                            <p className="text-sm text-center">{error}</p>
                        </div>
                    )}
                    {officePreviewUrl && (
                        <iframe
                            src={officePreviewUrl}
                            title={`${doc.title} preview`}
                            className="block w-full h-full border-0 bg-background"
                        />
                    )}
                </div>

                <div className="border-t bg-background px-3 py-2 text-xs text-muted-foreground">
                    DOCX preview uses Microsoft Office Web Viewer. If it does not load, open the original file instead.
                </div>
            </div>
        )
    }

    const zoomPercent = Math.round((1 + zoomOffset * 0.15) * 100)

    return (
        <div className="sticky top-32 flex flex-col border rounded-lg bg-muted/30 overflow-hidden" style={{ maxHeight: 'calc(100vh - 160px)' }}>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 p-2 border-b bg-background">
                <div className="flex items-center gap-1">
                    <Input
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value)}
                        onKeyDown={handlePageInput}
                        className="h-8 w-14 text-center text-xs"
                    />
                    <span className="text-xs text-muted-foreground">/ {numPages || '?'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomOffset(z => z - 1)} disabled={zoomOffset <= -3}>
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground w-10 text-center">{zoomPercent}%</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomOffset(z => z + 1)} disabled={zoomOffset >= 6}>
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    {zoomOffset !== 0 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomOffset(0)} title="Reset zoom">
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                    )}
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button 
                        variant={isEditMode ? "default" : "ghost"} 
                        size="icon" 
                        className={`h-8 w-8 transition-colors ${isEditMode ? 'bg-primary text-primary-foreground' : ''}`}
                        onClick={toggleEditMode} 
                        title="Toggle Edit Mode (Highlight & Note)"
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* PDF content — continuous vertical scroll */}
            <div
                ref={scrollContainerRef}
                onWheel={handleWheel}
                onMouseUp={handleMouseUp}
                className={`flex-1 overflow-auto p-2 relative ${isEditMode ? 'cursor-text' : ''}`}
                style={{ overscrollBehavior: 'contain' }}
            >
                {/* Floating Selection Toolbar */}
                {selectionRect && (
                    <div 
                        className="absolute z-50 bg-background border shadow-xl rounded-lg p-2 flex gap-2 items-center min-w-[320px] transition-all"
                        style={{ left: selectionRect.x, top: Math.max(0, selectionRect.y), transform: 'translateX(-50%)' }}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex bg-muted rounded overflow-hidden">
                            {[
                                { c: '#fef08a', n: 'Yellow' },
                                { c: '#bbf7d0', n: 'Green' }, 
                                { c: '#bfdbfe', n: 'Blue' }, 
                                { c: '#fecaca', n: 'Red' }
                            ].map(clr => (
                                <button
                                    key={clr.c}
                                    className={`w-6 h-6 hover:opacity-80 transition-opacity ${highlightColor === clr.c ? 'ring-2 ring-primary ring-inset' : ''}`}
                                    style={{ backgroundColor: clr.c }}
                                    onClick={() => setHighlightColor(clr.c)}
                                    title={`Highlight ${clr.n}`}
                                />
                            ))}
                        </div>
                        <Input 
                            placeholder="Add a note (optional)..." 
                            className="h-8 flex-1 text-xs"
                            value={noteInput}
                            onChange={e => setNoteInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') saveAnnotation()
                            }}
                        />
                        <Button size="sm" onClick={saveAnnotation} className="h-8 px-3 gap-1.5 shrink-0">
                            <Highlighter className="w-3.5 h-3.5" />
                            Save
                        </Button>
                    </div>
                )}

                {loading && !signedUrl && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}
                {error && (
                    <div className="flex flex-col items-center justify-center py-20 text-destructive">
                        <AlertCircle className="w-8 h-8 mb-2" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                {signedUrl && (
                    <Document
                        file={signedUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={() => { setError('Failed to load PDF'); setLoading(false) }}
                        loading={<Loader2 className="w-8 h-8 animate-spin text-primary" />}
                    >
                        <div className="flex flex-col items-center gap-2">
                            {Array.from({ length: numPages }, (_, i) => (
                                <div
                                    key={i + 1}
                                    ref={(el) => setPageRef(i + 1, el)}
                                    data-page={i + 1}
                                    className="relative"
                                >
                                    <Page
                                        pageNumber={i + 1}
                                        width={pageWidth}
                                        loading={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
                                    />
                                    {/* Overlays for Highlights */}
                                    <div className="absolute inset-0 z-10 pointer-events-none mix-blend-multiply">
                                        {annotations.filter(a => a.page === i + 1).map(ann => (
                                            ann.rects.map((r, rIdx) => (
                                                <div
                                                    key={`${ann.id}-${rIdx}`}
                                                    className="absolute pointer-events-auto cursor-help"
                                                    style={{
                                                        left: `${r.x}%`,
                                                        top: `${r.y}%`,
                                                        width: `${r.width}%`,
                                                        height: `${r.height}%`,
                                                        backgroundColor: ann.color,
                                                        opacity: 0.4
                                                    }}
                                                    title={ann.note ? `Note: ${ann.note}` : 'Highlight'}
                                                />
                                            ))
                                        ))}
                                    </div>
                                    <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground/60 bg-background/80 px-1.5 rounded z-20">
                                        {i + 1}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Document>
                )}
            </div>
        </div>
    )
}
