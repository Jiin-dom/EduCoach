import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Play,
    Sparkles,
    Grid3X3,
    Layers,
    Zap,
    AlertTriangle,
    Code,
    Network,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
    ListChecks,
} from 'lucide-react'
import type { StructuredSummary } from '@/hooks/useDocuments'
import type { Concept } from '@/hooks/useConcepts'
import { cleanDisplayText, escapeRegExp, buildKeywordPool, splitIntoSentences } from '@/lib/studyUtils'
import { KeyTermsGroup } from './KeyTermsGroup'

const SECTION_ICON_MAP: Record<string, React.ElementType> = {
    play: Play, sparkles: Sparkles, grid: Grid3X3, layers: Layers, zap: Zap,
    'alert-triangle': AlertTriangle, code: Code, network: Network, 'book-open': BookOpen,
}

const SECTION_COLOR_MAP: Record<string, string> = {
    play: 'text-orange-500 border-orange-300',
    sparkles: 'text-blue-500 border-blue-300',
    grid: 'text-green-500 border-green-300',
    layers: 'text-purple-500 border-purple-300',
    zap: 'text-yellow-500 border-yellow-300',
    'alert-triangle': 'text-red-500 border-red-300',
    code: 'text-teal-500 border-teal-300',
    network: 'text-indigo-500 border-indigo-300',
    'book-open': 'text-blue-500 border-blue-300',
}

const BULLET_LABEL_COLORS: Record<string, string> = {
    DEFINITION: 'bg-blue-50 text-blue-700 border-blue-200',
    'KEY CONCEPT': 'bg-purple-50 text-purple-700 border-purple-200',
    'KEY DISTINCTION': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    PROCESS: 'bg-green-50 text-green-700 border-green-200',
    EXAMPLE: 'bg-orange-50 text-orange-700 border-orange-200',
    CHALLENGE: 'bg-red-50 text-red-700 border-red-200',
    ADVANTAGE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

interface GuideTabProps {
    summary: string | null
    structuredSummary?: StructuredSummary | null
    concepts: Concept[]
    onPageJump?: (page: number) => void
}

export function GuideTab({ summary, structuredSummary, concepts, onPageJump }: GuideTabProps) {
    const [highlightKeywords, setHighlightKeywords] = useState(true)
    const [expandedBullets, setExpandedBullets] = useState(false)

    const ss = structuredSummary

    const keywordPool = useMemo(() => buildKeywordPool(concepts), [concepts])
    const sortedKeywords = useMemo(() => [...keywordPool].sort((a, b) => b.length - a.length), [keywordPool])

    const renderText = (text: string) => {
        const cleaned = cleanDisplayText(text)
        if (!highlightKeywords || sortedKeywords.length === 0) return <span>{cleaned}</span>

        let result = cleaned
        sortedKeywords.forEach((kw) => {
            const escaped = escapeRegExp(kw)
            result = result.replace(new RegExp(`(${escaped})`, 'gi'), '|||$1|||')
        })

        const parts = result.split('|||')
        return (
            <>
                {parts.map((part, i) => {
                    const isKw = sortedKeywords.some(k => k.toLowerCase() === part.toLowerCase())
                    return isKw
                        ? <span key={i} className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-semibold transition-colors hover:bg-primary/20 inline-block mx-0.5 leading-none">{part}</span>
                        : <span key={i}>{part}</span>
                })}
            </>
        )
    }

    const handlePageClick = (page: number | undefined) => {
        if (page != null && onPageJump) onPageJump(page)
    }

    // Determine visible bullets (capped at 5 by default)
    const allBullets = ss?.bullets || []
    const visibleBullets = expandedBullets ? allBullets : allBullets.slice(0, 5)

    const hasContent = ss || summary

    if (!hasContent) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No study guide available yet. Process the document to generate one.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header controls */}
            <div className="flex items-center justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHighlightKeywords(p => !p)}
                    className="h-8 gap-1.5 text-xs"
                >
                    {highlightKeywords ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    Terms
                </Button>
            </div>

            {/* Short summary intro */}
            {ss?.short && (
                <div className="text-muted-foreground leading-relaxed">
                    {cleanDisplayText(ss.short).split(/\n\n+/).filter(Boolean).map((para, idx) => (
                        <p key={idx} className="mb-2">{renderText(para)}</p>
                    ))}
                </div>
            )}

            {/* Canonical sections */}
            {ss?.detailed && ss.detailed.length > 0 && (
                <div className="space-y-5">
                    {ss.detailed.map((section, idx) => {
                        const IconComp = SECTION_ICON_MAP[section.icon] || BookOpen
                        const colorClass = SECTION_COLOR_MAP[section.icon] || 'text-blue-500 border-blue-300'
                        const [textColor] = colorClass.split(' ')
                        const sectionId = `guide-section-${section.title.toLowerCase().replace(/\s+/g, '-')}`

                        return (
                            <div key={idx} id={sectionId} className={`relative overflow-hidden rounded-2xl border ${colorClass.split(' ').slice(1).join(' ').replace('300', '200')} bg-card shadow-sm hover:shadow-md transition-shadow scroll-mt-32`}>
                                <div className={`absolute top-0 left-0 w-1.5 h-full bg-current ${textColor}`} />
                                <div className="p-5 sm:p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl bg-current/10 ${textColor}`}>
                                                <IconComp className="w-5 h-5" />
                                            </div>
                                            <h4 className={`text-base font-bold uppercase tracking-wider ${textColor}`}>
                                                {section.title}
                                            </h4>
                                        </div>
                                        {section.pages && section.pages.length > 0 && (
                                            <button onClick={() => handlePageClick(section.pages?.[0])}>
                                                <Badge variant="outline" className="text-xs gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-accent shadow-sm rounded-lg font-bold">
                                                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                                    p.{section.pages.join(', ')}
                                                </Badge>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-muted-foreground leading-relaxed text-[15px]">
                                        {renderText(section.content)}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Fallback when no structured summary */}
            {!ss?.detailed?.length && !ss?.short && summary && (
                <div className="text-muted-foreground leading-relaxed">
                    {cleanDisplayText(summary).split(/\n\n+/).filter(Boolean).map((para, idx) => (
                        <p key={idx} className="mb-2">{renderText(para)}</p>
                    ))}
                </div>
            )}

            {/* Bullet points */}
            {visibleBullets.length > 0 && (
                <div className="space-y-4 pt-2">
                    <h4 className="text-sm font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-primary" />
                        Key Points
                    </h4>
                    {visibleBullets.map((bullet, idx) => {
                        const labelColor = BULLET_LABEL_COLORS[bullet.label] || 'bg-gray-50 text-gray-700 border-gray-200'
                        return (
                            <div key={idx} className="group flex items-start gap-4 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 border border-border/50 transition-all shadow-sm">
                                <div className="mt-1 p-1.5 rounded-full bg-background shadow-sm border border-border">
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md shadow-sm ${labelColor}`}>
                                            {bullet.label}
                                        </Badge>
                                        {bullet.page != null && (
                                            <button onClick={() => handlePageClick(bullet.page)}>
                                                <Badge variant="outline" className="text-xs gap-1 cursor-pointer hover:bg-accent rounded-lg">
                                                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                                                    p.{bullet.page}
                                                </Badge>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[15px] text-muted-foreground leading-relaxed">
                                        {renderText(bullet.text)}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                    {allBullets.length > 5 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-xs w-full rounded-xl mt-2 font-bold bg-muted/30 hover:bg-muted/60"
                            onClick={() => setExpandedBullets(p => !p)}
                        >
                            {expandedBullets ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {expandedBullets ? 'Show fewer' : `Show all ${allBullets.length} points`}
                        </Button>
                    )}
                </div>
            )}

            {/* Fallback bullets from plain summary */}
            {allBullets.length === 0 && summary && !ss?.detailed?.length && (
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                    {splitIntoSentences(summary).map((sentence, idx) => (
                        <li key={idx} className="leading-relaxed">{renderText(sentence)}</li>
                    ))}
                </ul>
            )}

            {/* Key Terms */}
            <KeyTermsGroup concepts={concepts} keywords={keywordPool} />
        </div>
    )
}
