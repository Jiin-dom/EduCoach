import { useState, useEffect } from 'react'
import { BookOpen, Layers, ListChecks, Sparkles, CheckCircle2 } from 'lucide-react'

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
    const doneCount = STEPS.filter(s => getStatus(s.id) === 'done').length

    const handleClick = (step: Step) => {
        if (onSelectTab && step.sectionId.startsWith('tab-')) {
            onSelectTab(step.sectionId.replace('tab-', ''))
        } else {
            const el = document.getElementById(step.sectionId)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        
        if (getStatus(step.id) === 'not_started') {
            setStepState(prev => ({ ...prev, [step.id]: 'in_progress' }))
        }
    }

    const markDone = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setStepState(prev => ({ ...prev, [id]: prev[id] === 'done' ? 'in_progress' : 'done' }))
    }

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Study Path
                </h3>
                <div className="flex items-center gap-3">
                    <div className="w-32 h-2.5 bg-muted rounded-full overflow-hidden shadow-inner border border-border/50">
                        <div className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">{doneCount}/{STEPS.length}</span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {STEPS.map((step) => {
                    const s = getStatus(step.id)
                    const Icon = step.icon
                    const isDone = s === 'done'
                    const isInProgress = s === 'in_progress'
                    
                    return (
                        <button
                            key={step.id}
                            onClick={() => handleClick(step)}
                            className={`relative overflow-hidden flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all duration-300 text-left group ${
                                isDone
                                    ? 'border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-sm'
                                    : isInProgress
                                        ? 'border-primary/60 bg-background shadow-md shadow-primary/10 -translate-y-0.5'
                                        : 'border-border/50 bg-muted/30 hover:bg-muted/60 hover:border-border shadow-sm'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full relative z-10">
                                <div className={`p-2.5 rounded-xl transition-colors ${isDone ? 'bg-primary/20 text-primary' : isInProgress ? 'bg-primary/10 text-primary' : 'bg-background shadow-sm border text-muted-foreground group-hover:text-foreground'}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                {isDone && <CheckCircle2 className="w-5 h-5 text-primary animate-in zoom-in duration-300" />}
                            </div>
                            <div className="relative z-10 space-y-1 mt-1 w-full">
                                <h4 className={`text-sm font-bold ${isDone ? 'text-foreground' : 'text-foreground/90'}`}>{step.label}</h4>
                                <div className="text-xs font-semibold text-muted-foreground/80 flex items-center justify-between">
                                    {step.duration}
                                    {!isDone && (
                                        <div
                                            className={`h-6 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold transition-all border ${isInProgress ? 'opacity-100 bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary' : 'opacity-0 group-hover:opacity-100 bg-background border-border hover:bg-muted text-muted-foreground'}`}
                                            onClick={(e) => markDone(step.id, e)}
                                        >
                                            Mark Done
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
