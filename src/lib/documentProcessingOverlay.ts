export type DocumentProcessingOverlayContext =
    | "single_upload"
    | "files_manual"
    | "detail_manual"

export type DocumentProcessingOverlayPhase =
    | "uploading"
    | "processing"
    | "finalizing"

export type DocumentProcessingOverlayStepStatus =
    | "waiting"
    | "active"
    | "complete"

export interface DocumentProcessingOverlayCopy {
    title: string
    message: string
    steps: [string, string, string]
}

export interface DocumentProcessingOverlayStep {
    label: string
    status: DocumentProcessingOverlayStepStatus
}

const OVERLAY_COPY: Record<DocumentProcessingOverlayContext, DocumentProcessingOverlayCopy> = {
    single_upload: {
        title: "Uploading and processing your document",
        message:
            "Keep this page open while EduCoach uploads the file, extracts concepts, and prepares your study materials.",
        steps: ["Upload", "Analyze", "Prepare"],
    },
    files_manual: {
        title: "Processing document",
        message:
            "EduCoach is extracting concepts, summaries, flashcards, and notes. The file list will update when processing finishes.",
        steps: ["Read", "Analyze", "Prepare"],
    },
    detail_manual: {
        title: "Preparing this document",
        message:
            "EduCoach is unlocking the guide, concepts, flashcards, and notes for this file. You can keep the page open while it works.",
        steps: ["Read", "Analyze", "Prepare"],
    },
}

export function getDocumentProcessingOverlayCopy(
    context: DocumentProcessingOverlayContext,
): DocumentProcessingOverlayCopy {
    return OVERLAY_COPY[context]
}

export function buildDocumentProcessingOverlaySteps(
    context: DocumentProcessingOverlayContext,
    phase: DocumentProcessingOverlayPhase,
): DocumentProcessingOverlayStep[] {
    const labels = OVERLAY_COPY[context].steps

    if (phase === "uploading") {
        return [
            { label: labels[0], status: "active" },
            { label: labels[1], status: "waiting" },
            { label: labels[2], status: "waiting" },
        ]
    }

    if (phase === "finalizing") {
        return [
            { label: labels[0], status: "complete" },
            { label: labels[1], status: "complete" },
            { label: labels[2], status: "active" },
        ]
    }

    return [
        { label: labels[0], status: "complete" },
        { label: labels[1], status: "active" },
        { label: labels[2], status: "waiting" },
    ]
}
