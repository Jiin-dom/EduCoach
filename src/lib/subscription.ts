export type SubscriptionPlan = "free" | "premium"
export type SubscriptionStatus = "active" | "cancelled" | "suspended"

export const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlan = "free"
export const DEFAULT_SUBSCRIPTION_STATUS: SubscriptionStatus = "active"
export const AI_TUTOR_FREE_DAILY_LIMIT = 20
export const FREE_DOCUMENT_LIMIT = 5
export const PREMIUM_MONTHLY_PRICE_PHP = 299
const DAY_MS = 24 * 60 * 60 * 1000

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

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function isTrialActive(trialEndsAt: unknown, now: Date = new Date()): boolean {
  const trialEnd = parseIsoDate(trialEndsAt)
  if (!trialEnd) return false
  return trialEnd.getTime() > now.getTime()
}

export function getTrialDaysLeft(trialEndsAt: unknown, now: Date = new Date()): number {
  const trialEnd = parseIsoDate(trialEndsAt)
  if (!trialEnd) return 0

  const diffMs = trialEnd.getTime() - now.getTime()
  if (diffMs <= 0) return 0

  return Math.ceil(diffMs / DAY_MS)
}

export function hasPremiumEntitlement(plan: unknown, status: unknown, trialEndsAt?: unknown, now: Date = new Date()): boolean {
  return isPremiumPlan(plan, status) || isTrialActive(trialEndsAt, now)
}

export function canAccessFullAnalytics(plan: unknown, status: unknown, trialEndsAt?: unknown, now: Date = new Date()): boolean {
  return hasPremiumEntitlement(plan, status, trialEndsAt, now)
}

export function getQuizPriority(plan: SubscriptionPlan): number {
  return plan === "premium" ? 2 : 1
}

export function getPlanDisplayName(plan: SubscriptionPlan): "Free" | "Premium" {
  return plan === "premium" ? "Premium" : "Free"
}

export function canUploadMoreDocuments(documentCount: number, hasPremium: boolean): boolean {
  if (hasPremium) return true
  return documentCount < FREE_DOCUMENT_LIMIT
}

export function getRemainingUploadSlots(documentCount: number, hasPremium: boolean): number {
  if (hasPremium) return Infinity
  return Math.max(FREE_DOCUMENT_LIMIT - documentCount, 0)
}
