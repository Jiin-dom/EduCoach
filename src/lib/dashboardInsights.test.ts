import { describe, expect, it } from "vitest"

import {
  buildDashboardMasterySummary,
  getDashboardAnalyticsCta,
  selectDashboardProgressInsight,
} from "@/lib/dashboardInsights"

describe("selectDashboardProgressInsight", () => {
  it("prefers the 30-day score trend when score data exists", () => {
    const result = selectDashboardProgressInsight(
      [{ date: "2026-04-01", score: 78 }],
      [{ date: "2026-04-01", count: 12 }],
    )

    expect(result.kind).toBe("score_trend")
    expect(result.description).toContain("30 days")
  })

  it("falls back to study activity when score trend is empty", () => {
    const result = selectDashboardProgressInsight([], [{ date: "2026-04-01", count: 9 }])

    expect(result.kind).toBe("study_activity")
    expect(result.description).toContain("90 days")
  })

  it("returns an empty insight when there is no progress data", () => {
    const result = selectDashboardProgressInsight([], [])

    expect(result.kind).toBe("empty")
    expect(result.description).toBe("Take a quiz to see progress")
  })
})

describe("buildDashboardMasterySummary", () => {
  it("groups attempt-backed rows by document and sorts by average mastery", () => {
    const result = buildDashboardMasterySummary([
      {
        document_id: "doc-1",
        document_title: "Biology",
        display_mastery_score: 92,
        display_mastery_level: "mastered",
        total_attempts: 4,
      },
      {
        document_id: "doc-1",
        document_title: "Biology",
        display_mastery_score: 78,
        display_mastery_level: "developing",
        total_attempts: 3,
      },
      {
        document_id: "doc-2",
        document_title: "Physics",
        display_mastery_score: 55,
        display_mastery_level: "needs_review",
        total_attempts: 2,
      },
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      documentId: "doc-1",
      title: "Biology",
      averageMastery: 85,
      conceptCount: 2,
      masteredCount: 1,
      developingCount: 1,
      needsReviewCount: 0,
    })
  })

  it("excludes zero-attempt placeholder rows from the summary", () => {
    const result = buildDashboardMasterySummary([
      {
        document_id: "doc-1",
        document_title: "Chemistry",
        display_mastery_score: 88,
        display_mastery_level: "mastered",
        total_attempts: 0,
      },
      {
        document_id: "doc-2",
        document_title: "History",
        display_mastery_score: 61,
        display_mastery_level: "developing",
        total_attempts: 1,
      },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].documentId).toBe("doc-2")
  })

  it("returns all grouped materials when no limit is provided and trims when a limit is set", () => {
    const rows = [
      {
        document_id: "doc-1",
        document_title: "Biology",
        display_mastery_score: 92,
        display_mastery_level: "mastered" as const,
        total_attempts: 4,
      },
      {
        document_id: "doc-2",
        document_title: "Physics",
        display_mastery_score: 70,
        display_mastery_level: "developing" as const,
        total_attempts: 2,
      },
      {
        document_id: "doc-3",
        document_title: "Chemistry",
        display_mastery_score: 55,
        display_mastery_level: "needs_review" as const,
        total_attempts: 1,
      },
      {
        document_id: "doc-4",
        document_title: "History",
        display_mastery_score: 44,
        display_mastery_level: "needs_review" as const,
        total_attempts: 1,
      },
    ]

    expect(buildDashboardMasterySummary(rows)).toHaveLength(4)
    expect(buildDashboardMasterySummary(rows, 3)).toHaveLength(3)
  })
})

describe("getDashboardAnalyticsCta", () => {
  it("routes premium students to the analytics workspace", () => {
    expect(getDashboardAnalyticsCta(true)).toEqual({
      href: "/analytics",
      label: "Open Full Analytics",
    })
  })

  it("routes free students to subscription for deeper analytics", () => {
    expect(getDashboardAnalyticsCta(false)).toEqual({
      href: "/subscription",
      label: "Unlock Advanced Analytics",
    })
  })
})
