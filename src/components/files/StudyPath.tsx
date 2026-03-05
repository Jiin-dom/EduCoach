import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Clock, BookOpen, Layers, ListChecks, Sparkles } from 'lucide-react'

type StepStatus = 'not_started' | 'in_progress' | 'done'

interface Step {
    id: string
    label: string
    duration: string
    icon: React.ElementType
    sectionId: string
}

const STEPS: Step[] = [
    { id: 'overview', label: 'Overview', duration: '2 min', icon: BookOpen, sectionId: 'guide-section-introduction' },
    { id: 'core', label: 'Core Concepts', duration: '10 min', icon: Layers, sectionId: 'guide-section-core-concepts' },
    { id: 'process', label: 'Process & Steps', duration: '5 min', icon: ListChecks, sectionId: 'guide-section-key-components' },
    { id: 'quiz', label: 'Quick Check', duration: 'Quiz', icon: Sparkles, sectionId: 'tab-quiz-prep' },
]

function loadState(documentId: string): Record<string, StepStatus> {
    try {
        const raw = localStorage.getItem(`study-path-${documentId}`)
        if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return {}
}

function saveState(documentId: string, state: Record<string, StepStatus>) {
    localStorage.setItem(`study-path-${documentId}`, JSON.stringify(state))
}

interface StudyPathProps {
    documentId: string
    onSelectTab?: (tab: string) => void
}

export function StudyPath({ documentId, onSelectTab }: StudyPathProps) {
    const [stepState, setStepState] = useState<Record<string, StepStatus>>(() => loadState(documentId))

    useEffect(() => { saveState(documentId, stepState) }, [documentId, stepState])

    const getStatus = (id: string): StepStatus => stepState[id] || 'not_started'

    const handleClick = useCallback((step: Step) => {
        if (step.id === 'quiz') {
            onSelectTab?.('quiz-prep')
            return
        }

        const el = document.getElementById(step.sectionId)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }

        setStepState(prev => {
            const cur = prev[step.id] || 'not_started'
            if (cur === 'done') return prev
            return { ...prev, [step.id]: 'in_progress' }
        })
    }, [onSelectTab])

    const markDone = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setStepState(prev => ({ ...prev, [id]: 'done' }))
    }, [])

    const doneCount = STEPS.filter(s => getStatus(s.id) === 'done').length

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Study Path</h3>
                <span className="text-xs text-muted-foreground">{doneCount}/{STEPS.length} completed</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {STEPS.map((step) => {
                    const s = getStatus(step.id)
                    const Icon = step.icon
                    const StatusIcon = s === 'done' ? CheckCircle2 : s === 'in_progress' ? Clock : Circle
                    return (
                        <button
                            key={step.id}
                            onClick={() => handleClick(step)}
                            className={`flex-1 min-w-[140px] flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors text-center ${
                                s === 'done'
                                    ? 'border-green-300 bg-green-50 dark:bg-green-950/30'
                                    : s === 'in_progress'
                                        ? 'border-primary/50 bg-primary/5'
                                        : 'border-muted hover:border-primary/30 hover:bg-accent/50'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <Icon className={`w-4 h-4 ${s === 'done' ? 'text-green-600' : 'text-primary'}`} />
                                <span className="text-sm font-medium">{step.label}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <StatusIcon className={`w-3 h-3 ${s === 'done' ? 'text-green-600' : s === 'in_progress' ? 'text-primary' : ''}`} />
                                {step.duration}
                            </div>
                            {s !== 'done' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs px-2 mt-1"
                                    onClick={(e) => markDone(step.id, e)}
                                >
                                    Mark done
                                </Button>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
