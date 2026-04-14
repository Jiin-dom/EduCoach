import { describe, expect, it } from "vitest"

import {
  AI_TUTOR_FREE_DAILY_LIMIT,
  canAccessFullAnalytics,
  getTrialDaysLeft,
  getPlanDisplayName,
  getQuizPriority,
  hasPremiumEntitlement,
  isTrialActive,
  isPremiumPlan,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "./subscription"

describe("subscription helpers", () => {
  it("normalizes unknown plan values to free", () => {
    expect(normalizeSubscriptionPlan("premium")).toBe("premium")
    expect(normalizeSubscriptionPlan("PREMIUM")).toBe("premium")
    expect(normalizeSubscriptionPlan("free")).toBe("free")
    expect(normalizeSubscriptionPlan("whatever")).toBe("free")
    expect(normalizeSubscriptionPlan(null)).toBe("free")
  })

  it("normalizes unknown status values to active", () => {
    expect(normalizeSubscriptionStatus("active")).toBe("active")
    expect(normalizeSubscriptionStatus("cancelled")).toBe("cancelled")
    expect(normalizeSubscriptionStatus("suspended")).toBe("suspended")
    expect(normalizeSubscriptionStatus("other")).toBe("active")
    expect(normalizeSubscriptionStatus(undefined)).toBe("active")
  })

  it("treats premium + active as premium access", () => {
    expect(isPremiumPlan("premium", "active")).toBe(true)
    expect(isPremiumPlan("premium", "cancelled")).toBe(false)
    expect(isPremiumPlan("free", "active")).toBe(false)
  })

  it("gates full analytics to active premium only", () => {
    expect(canAccessFullAnalytics("premium", "active")).toBe(true)
    expect(canAccessFullAnalytics("premium", "suspended")).toBe(false)
    expect(canAccessFullAnalytics("free", "active")).toBe(false)
  })

  it("treats active trial as premium entitlement", () => {
    const now = new Date("2026-03-27T00:00:00.000Z")
    const activeTrialEndsAt = "2026-03-30T00:00:00.000Z"
    const expiredTrialEndsAt = "2026-03-20T00:00:00.000Z"

    expect(isTrialActive(activeTrialEndsAt, now)).toBe(true)
    expect(isTrialActive(expiredTrialEndsAt, now)).toBe(false)
    expect(hasPremiumEntitlement("free", "active", activeTrialEndsAt, now)).toBe(true)
    expect(hasPremiumEntitlement("free", "active", expiredTrialEndsAt, now)).toBe(false)
    expect(canAccessFullAnalytics("free", "active", activeTrialEndsAt, now)).toBe(true)
  })

  it("computes trial days left from the trial end timestamp", () => {
    const now = new Date("2026-03-27T00:00:00.000Z")
    expect(getTrialDaysLeft("2026-03-29T00:00:00.000Z", now)).toBe(2)
    expect(getTrialDaysLeft("2026-03-27T00:00:00.000Z", now)).toBe(0)
    expect(getTrialDaysLeft("invalid-date", now)).toBe(0)
  })

  it("exposes the free daily AI tutor limit constant", () => {
    expect(AI_TUTOR_FREE_DAILY_LIMIT).toBe(20)
  })

  it("maps quiz priority with premium above free", () => {
    expect(getQuizPriority("premium")).toBeGreaterThan(getQuizPriority("free"))
    expect(getQuizPriority("free")).toBe(1)
    expect(getQuizPriority("premium")).toBe(2)
  })

  it("returns display labels for plans", () => {
    expect(getPlanDisplayName("free")).toBe("Free")
    expect(getPlanDisplayName("premium")).toBe("Premium")
  })

  it("keeps literal types stable", () => {
    const plan: SubscriptionPlan = "free"
    const status: SubscriptionStatus = "active"
    expect(plan).toBe("free")
    expect(status).toBe("active")
  })
})
