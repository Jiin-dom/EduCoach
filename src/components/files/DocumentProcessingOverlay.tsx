import { Brain, CheckCircle2, FileText, Loader2 } from "lucide-react"
import {
    buildDocumentProcessingOverlaySteps,
    getDocumentProcessingOverlayCopy,
    type DocumentProcessingOverlayContext,
    type DocumentProcessingOverlayPhase,
    type DocumentProcessingOverlayStep,
} from "@/lib/documentProcessingOverlay"

interface DocumentProcessingOverlayProps {
    context: DocumentProcessingOverlayContext
    phase: DocumentProcessingOverlayPhase
    documentTitle?: string | null
}

const STEP_ICON_MAP = [FileText, Brain, CheckCircle2] as const

function StepCard({ step, index }: { step: DocumentProcessingOverlayStep; index: number }) {
    const Icon = STEP_ICON_MAP[index] ?? FileText

    const toneClass = step.status === "complete"
        ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300"
        : step.status === "active"
            ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
            : "border-border bg-background/70 text-muted-foreground"

    return (
        <div className={`rounded-lg border px-2 py-3 transition-all duration-300 ${toneClass}`}>
            <div className="mx-auto mb-1.5 flex h-5 w-5 items-center justify-center">
                {step.status === "complete" ? (
                    <CheckCircle2 className="h-4 w-4" />
                ) : step.status === "active" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Icon className="h-4 w-4" />
                )}
            </div>
            <span className="font-medium">{step.label}</span>
        </div>
    )
}

export function DocumentProcessingOverlay({ context, phase, documentTitle }: DocumentProcessingOverlayProps) {
    const copy = getDocumentProcessingOverlayCopy(context)
    const steps = buildDocumentProcessingOverlaySteps(context, phase)

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-background/85 px-4 backdrop-blur-md"
            role="status"
            aria-live="polite"
            aria-label={copy.title}
        >
            <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-card p-6 text-center shadow-2xl">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">{copy.title}</h2>
                {documentTitle && (
                    <p className="mt-2 truncate text-sm font-medium text-foreground/80" title={documentTitle}>
                        {documentTitle}
                    </p>
                )}
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {copy.message}
                </p>
                <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
                    {steps.map((step, index) => (
                        <StepCard key={step.label} step={step} index={index} />
                    ))}
                </div>
            </div>
        </div>
    )
}
