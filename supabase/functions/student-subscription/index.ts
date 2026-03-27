import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const PREMIUM_MONTHLY_PRICE_PHP = 299
const BILLING_CYCLE_DAYS = 30

type StudentSubscriptionRequest =
  | { action: "get_my_subscription" }
  | { action: "mock_subscribe_premium" }

interface SubscriptionRow {
  user_id: string
  plan: "free" | "premium"
  status: "active" | "cancelled" | "suspended"
  amount_php: number
  currency: string
  started_at: string
  next_billing_at: string | null
  ends_at: string | null
  renewed_at: string | null
  trial_started_at: string | null
  trial_ends_at: string | null
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null
  return authHeader.slice(7).trim() || null
}

function normalizePlan(value: unknown): "free" | "premium" {
  return value === "premium" ? "premium" : "free"
}

function normalizeStatus(value: unknown): "active" | "cancelled" | "suspended" {
  if (value === "cancelled" || value === "suspended") {
    return value
  }
  return "active"
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function isTrialActive(trialEndsAt: string | null, now = new Date()): boolean {
  const trialEnd = parseDate(trialEndsAt)
  if (!trialEnd) return false
  return trialEnd.getTime() > now.getTime()
}

function getTrialDaysLeft(trialEndsAt: string | null, now = new Date()): number {
  const trialEnd = parseDate(trialEndsAt)
  if (!trialEnd) return 0

  const diffMs = trialEnd.getTime() - now.getTime()
  if (diffMs <= 0) return 0

  const dayMs = 24 * 60 * 60 * 1000
  return Math.ceil(diffMs / dayMs)
}

function hasPremiumEntitlement(subscription: Pick<SubscriptionRow, "plan" | "status" | "trial_ends_at">, now = new Date()): boolean {
  const premiumActive = subscription.plan === "premium" && subscription.status === "active"
  return premiumActive || isTrialActive(subscription.trial_ends_at, now)
}

function toSnapshot(subscription: SubscriptionRow) {
  const now = new Date()
  return {
    userId: subscription.user_id,
    plan: subscription.plan,
    status: subscription.status,
    amountPhp: subscription.amount_php,
    currency: subscription.currency,
    startedAt: subscription.started_at,
    nextBillingAt: subscription.next_billing_at,
    endsAt: subscription.ends_at,
    renewedAt: subscription.renewed_at,
    trialStartedAt: subscription.trial_started_at,
    trialEndsAt: subscription.trial_ends_at,
    isTrialActive: isTrialActive(subscription.trial_ends_at, now),
    trialDaysLeft: getTrialDaysLeft(subscription.trial_ends_at, now),
    hasPremiumEntitlement: hasPremiumEntitlement(subscription, now),
  }
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

async function getOrCreateSubscription(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<SubscriptionRow> {
  const { data, error } = await serviceClient
    .from("subscriptions")
    .select(
      "user_id, plan, status, amount_php, currency, started_at, next_billing_at, ends_at, renewed_at, trial_started_at, trial_ends_at"
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || "Failed to load subscription")
  }

  if (data) {
    return {
      user_id: data.user_id,
      plan: normalizePlan(data.plan),
      status: normalizeStatus(data.status),
      amount_php: data.amount_php ?? 0,
      currency: data.currency ?? "PHP",
      started_at: data.started_at,
      next_billing_at: data.next_billing_at,
      ends_at: data.ends_at,
      renewed_at: data.renewed_at,
      trial_started_at: data.trial_started_at,
      trial_ends_at: data.trial_ends_at,
    }
  }

  const startedAt = new Date().toISOString()
  const { data: created, error: insertError } = await serviceClient
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan: "free",
      status: "active",
      amount_php: 0,
      currency: "PHP",
      started_at: startedAt,
      trial_started_at: null,
      trial_ends_at: null,
    })
    .select(
      "user_id, plan, status, amount_php, currency, started_at, next_billing_at, ends_at, renewed_at, trial_started_at, trial_ends_at"
    )
    .single()

  if (insertError || !created) {
    throw new Error(insertError?.message || "Failed to initialize subscription")
  }

  return {
    user_id: created.user_id,
    plan: normalizePlan(created.plan),
    status: normalizeStatus(created.status),
    amount_php: created.amount_php ?? 0,
    currency: created.currency ?? "PHP",
    started_at: created.started_at,
    next_billing_at: created.next_billing_at,
    ends_at: created.ends_at,
    renewed_at: created.renewed_at,
    trial_started_at: created.trial_started_at,
    trial_ends_at: created.trial_ends_at,
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { success: false, error: "Method not allowed" })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { success: false, error: "Missing Supabase environment configuration" })
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    const token = extractBearerToken(req.headers.get("Authorization"))
    if (!token) {
      return jsonResponse(401, { success: false, error: "Missing authorization token" })
    }

    const {
      data: { user: callerUser },
      error: authError,
    } = await serviceClient.auth.getUser(token)

    if (authError || !callerUser) {
      return jsonResponse(401, { success: false, error: "Invalid or expired token" })
    }

    const body = (await req.json()) as Partial<StudentSubscriptionRequest>

    if (body.action === "get_my_subscription") {
      const subscription = await getOrCreateSubscription(serviceClient, callerUser.id)
      return jsonResponse(200, { success: true, data: toSnapshot(subscription) })
    }

    if (body.action === "mock_subscribe_premium") {
      const existing = await getOrCreateSubscription(serviceClient, callerUser.id)
      const now = new Date()
      const nowIso = now.toISOString()
      const nextBillingIso = new Date(now.getTime() + BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const { data: updated, error: updateError } = await serviceClient
        .from("subscriptions")
        .upsert(
          {
            user_id: callerUser.id,
            plan: "premium",
            status: "active",
            amount_php: PREMIUM_MONTHLY_PRICE_PHP,
            currency: "PHP",
            started_at: existing.started_at || nowIso,
            next_billing_at: nextBillingIso,
            renewed_at: nowIso,
            trial_started_at: existing.trial_started_at,
            trial_ends_at: existing.trial_ends_at,
          },
          { onConflict: "user_id" }
        )
        .select(
          "user_id, plan, status, amount_php, currency, started_at, next_billing_at, ends_at, renewed_at, trial_started_at, trial_ends_at"
        )
        .single()

      if (updateError || !updated) {
        return jsonResponse(500, { success: false, error: updateError?.message || "Failed to upgrade subscription" })
      }

      const normalized: SubscriptionRow = {
        user_id: updated.user_id,
        plan: normalizePlan(updated.plan),
        status: normalizeStatus(updated.status),
        amount_php: updated.amount_php ?? PREMIUM_MONTHLY_PRICE_PHP,
        currency: updated.currency ?? "PHP",
        started_at: updated.started_at,
        next_billing_at: updated.next_billing_at,
        ends_at: updated.ends_at,
        renewed_at: updated.renewed_at,
        trial_started_at: updated.trial_started_at,
        trial_ends_at: updated.trial_ends_at,
      }

      return jsonResponse(200, { success: true, data: toSnapshot(normalized) })
    }

    return jsonResponse(400, { success: false, error: "Unsupported action" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return jsonResponse(500, { success: false, error: message })
  }
})
