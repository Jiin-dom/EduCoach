import { describe, expect, it } from "vitest"

import { shouldSuppressAdaptiveQuizTask } from "./useAdaptiveQuizPolicies"

describe("shouldSuppressAdaptiveQuizTask", () => {
    const todayLocal = "2026-05-01"
    const completedAdaptiveDocumentIdsToday = new Set(["doc-1"])

    it("suppresses only today's quiz task after today's adaptive completion", () => {
        expect(
            shouldSuppressAdaptiveQuizTask({
                taskType: "quiz",
                taskDocumentId: "doc-1",
                taskScheduledDate: todayLocal,
                todayLocal,
                completedAdaptiveDocumentIdsToday,
            }),
        ).toBe(true)
    })

    it("does not suppress future quiz tasks for the same document", () => {
        expect(
            shouldSuppressAdaptiveQuizTask({
                taskType: "quiz",
                taskDocumentId: "doc-1",
                taskScheduledDate: "2026-05-02",
                todayLocal,
                completedAdaptiveDocumentIdsToday,
            }),
        ).toBe(false)
    })
})
