export interface DashboardScoreTrendPoint {
  date: string
  score: number
}

export interface DashboardActivityDay {
  date: string
  count: number
}

export interface DashboardMasteryRow {
  document_id: string | null
  document_title: string | null
  display_mastery_score: number
  display_mastery_level: "mastered" | "developing" | "needs_review"
  total_attempts: number
}

export interface DashboardMasterySummaryItem {
  documentId: string
  title: string
  averageMastery: number
  conceptCount: number
  masteredCount: number
  developingCount: number
  needsReviewCount: number
}

export type DashboardProgressInsight =
  | {
      kind: "score_trend"
      title: string
      description: string
      data: DashboardScoreTrendPoint[]
    }
  | {
      kind: "study_activity"
      title: string
      description: string
      data: DashboardActivityDay[]
    }
  | {
      kind: "empty"
      title: string
      description: string
      data: []
    }

export function selectDashboardProgressInsight(
  scoreTrend: DashboardScoreTrendPoint[] | null | undefined,
  studyActivity: DashboardActivityDay[] | null | undefined,
): DashboardProgressInsight {
  if (scoreTrend && scoreTrend.length > 0) {
    return {
      kind: "score_trend",
      title: "Progress Chart",
      description: "Average quiz score over the last 30 days",
      data: scoreTrend,
    }
  }

  if (studyActivity && studyActivity.length > 0) {
    return {
      kind: "study_activity",
      title: "Progress Chart",
      description: "Questions answered per day over the last 90 days",
      data: studyActivity,
    }
  }

  return {
    kind: "empty",
    title: "Progress Chart",
    description: "Take a quiz to see progress",
    data: [],
  }
}

export function buildDashboardMasterySummary(
  masteryRows: DashboardMasteryRow[] | null | undefined,
  limit?: number,
): DashboardMasterySummaryItem[] {
  const attemptBackedRows = (masteryRows || []).filter((row) => row.total_attempts > 0)
  const groups = new Map<string, DashboardMasterySummaryItem>()

  for (const row of attemptBackedRows) {
    const documentId = row.document_id ?? "unknown"
    const title = row.document_title ?? "Unknown Document"

    if (!groups.has(documentId)) {
      groups.set(documentId, {
        documentId,
        title,
        averageMastery: 0,
        conceptCount: 0,
        masteredCount: 0,
        developingCount: 0,
        needsReviewCount: 0,
      })
    }

    const group = groups.get(documentId)!
    group.averageMastery += Number(row.display_mastery_score)
    group.conceptCount += 1

    if (row.display_mastery_level === "mastered") group.masteredCount += 1
    else if (row.display_mastery_level === "developing") group.developingCount += 1
    else group.needsReviewCount += 1
  }

  const sorted = Array.from(groups.values())
    .map((group) => ({
      ...group,
      averageMastery: group.conceptCount > 0 ? Math.round(group.averageMastery / group.conceptCount) : 0,
    }))
    .sort((a, b) => b.averageMastery - a.averageMastery)

  return typeof limit === "number" ? sorted.slice(0, limit) : sorted
}

export function getDashboardAnalyticsCta(hasPremiumEntitlement: boolean) {
  return hasPremiumEntitlement
    ? {
        href: "/analytics",
        label: "Open Full Analytics",
      }
    : {
        href: "/subscription",
        label: "Unlock Advanced Analytics",
      }
}
