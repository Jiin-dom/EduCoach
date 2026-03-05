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
                        ? <span key={i} className="bg-primary/15 text-primary px-1 rounded font-medium">{part}</span>
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
                <div className="space-y-4">
                    {ss.detailed.map((section, idx) => {
                        const IconComp = SECTION_ICON_MAP[section.icon] || BookOpen
                        const colorClass = SECTION_COLOR_MAP[section.icon] || 'text-blue-500 border-blue-300'
                        const [textColor] = colorClass.split(' ')
                        const sectionId = `guide-section-${section.title.toLowerCase().replace(/\s+/g, '-')}`

                        return (
                            <div key={idx} id={sectionId} className={`border-l-4 ${colorClass.split(' ').slice(1).join(' ')} pl-4 py-3 scroll-mt-32`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <IconComp className={`w-4 h-4 ${textColor}`} />
                                        <h4 className={`text-sm font-semibold uppercase tracking-wide ${textColor}`}>
                                            {section.title}
                                        </h4>
                                    </div>
                                    {section.pages && section.pages.length > 0 && (
                                        <button onClick={() => handlePageClick(section.pages?.[0])}>
                                            <Badge variant="outline" className="text-xs gap-1 cursor-pointer hover:bg-accent">
                                                <BookOpen className="w-3 h-3" />
                                                p.{section.pages.join(', ')}
                                            </Badge>
                                        </button>
                                    )}
                                </div>
                                <p className="text-muted-foreground leading-relaxed text-sm">
                                    {renderText(section.content)}
                                </p>
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
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Key Points</h4>
                    {visibleBullets.map((bullet, idx) => {
                        const labelColor = BULLET_LABEL_COLORS[bullet.label] || 'bg-gray-50 text-gray-700 border-gray-200'
                        return (
                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
                                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge variant="outline" className={`text-xs font-semibold ${labelColor}`}>
                                            {bullet.label}
                                        </Badge>
                                        {bullet.page != null && (
                                            <button onClick={() => handlePageClick(bullet.page)}>
                                                <Badge variant="outline" className="text-xs gap-1 cursor-pointer hover:bg-accent">
                                                    <BookOpen className="w-3 h-3" />
                                                    p.{bullet.page}
                                                </Badge>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {renderText(bullet.text)}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                    {allBullets.length > 5 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs w-full"
                            onClick={() => setExpandedBullets(p => !p)}
                        >
                            {expandedBullets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
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
