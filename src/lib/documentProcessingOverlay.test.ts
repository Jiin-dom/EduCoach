import { describe, expect, it } from "vitest"
import {
    buildDocumentProcessingOverlaySteps,
    getDocumentProcessingOverlayCopy,
} from "@/lib/documentProcessingOverlay"

describe("getDocumentProcessingOverlayCopy", () => {
    it("returns a single-upload message while upload processing is running", () => {
        expect(getDocumentProcessingOverlayCopy("single_upload")).toEqual({
            title: "Uploading and processing your document",
            message:
                "Keep this page open while EduCoach uploads the file, extracts concepts, and prepares your study materials.",
            steps: ["Upload", "Analyze", "Prepare"],
        })
    })

    it("returns a manual processing message for the Files page", () => {
        expect(getDocumentProcessingOverlayCopy("files_manual")).toEqual({
            title: "Processing document",
            message:
                "EduCoach is extracting concepts, summaries, flashcards, and notes. The file list will update when processing finishes.",
            steps: ["Read", "Analyze", "Prepare"],
        })
    })

    it("returns a focused manual processing message for the file detail page", () => {
        expect(getDocumentProcessingOverlayCopy("detail_manual")).toEqual({
            title: "Preparing this document",
            message:
                "EduCoach is unlocking the guide, concepts, flashcards, and notes for this file. You can keep the page open while it works.",
            steps: ["Read", "Analyze", "Prepare"],
        })
    })
})

describe("buildDocumentProcessingOverlaySteps", () => {
    it("marks upload active before the uploaded document is ready to process", () => {
        expect(buildDocumentProcessingOverlaySteps("single_upload", "uploading")).toEqual([
            { label: "Upload", status: "active" },
            { label: "Analyze", status: "waiting" },
            { label: "Prepare", status: "waiting" },
        ])
    })

    it("marks upload complete while single-upload processing is analyzing", () => {
        expect(buildDocumentProcessingOverlaySteps("single_upload", "processing")).toEqual([
            { label: "Upload", status: "complete" },
            { label: "Analyze", status: "active" },
            { label: "Prepare", status: "waiting" },
        ])
    })

    it("marks manual document reading complete while analysis is running", () => {
        expect(buildDocumentProcessingOverlaySteps("files_manual", "processing")).toEqual([
            { label: "Read", status: "complete" },
            { label: "Analyze", status: "active" },
            { label: "Prepare", status: "waiting" },
        ])
    })

    it("marks preparation active after analysis finishes", () => {
        expect(buildDocumentProcessingOverlaySteps("detail_manual", "finalizing")).toEqual([
            { label: "Read", status: "complete" },
            { label: "Analyze", status: "complete" },
            { label: "Prepare", status: "active" },
        ])
    })
})
