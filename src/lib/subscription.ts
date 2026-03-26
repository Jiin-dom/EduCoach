export type SubscriptionPlan = "free" | "premium"
export type SubscriptionStatus = "active" | "cancelled" | "suspended"

export const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlan = "free"
export const DEFAULT_SUBSCRIPTION_STATUS: SubscriptionStatus = "active"
export const AI_TUTOR_FREE_DAILY_LIMIT = 20
export const PREMIUM_MONTHLY_PRICE_PHP = 299

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  if (typeof value !== "string") return DEFAULT_SUBSCRIPTION_PLAN
  const normalized = value.trim().toLowerCase()
  return normalized === "premium" ? "premium" : "free"
}

export function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus {
  if (typeof value !== "string") return DEFAULT_SUBSCRIPTION_STATUS
  const normalized = value.trim().toLowerCase()
  if (normalized === "cancelled" || normalized === "suspended" || normalized === "active") {
    return normalized
  }
  return DEFAULT_SUBSCRIPTION_STATUS
}

export function isPremiumPlan(plan: unknown, status: unknown): boolean {
  return normalizeSubscriptionPlan(plan) === "premium" && normalizeSubscriptionStatus(status) === "active"
}

export function canAccessFullAnalytics(plan: unknown, status: unknown): boolean {
  return isPremiumPlan(plan, status)
}

export function getQuizPriority(plan: SubscriptionPlan): number {
  return plan === "premium" ? 2 : 1
}

export function getPlanDisplayName(plan: SubscriptionPlan): "Free" | "Premium" {
  return plan === "premium" ? "Premium" : "Free"
}
