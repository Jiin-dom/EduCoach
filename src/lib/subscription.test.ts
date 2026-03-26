import { describe, expect, it } from "vitest"

import {
  AI_TUTOR_FREE_DAILY_LIMIT,
  canAccessFullAnalytics,
  getPlanDisplayName,
  getQuizPriority,
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
