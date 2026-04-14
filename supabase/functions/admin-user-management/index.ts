import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ManageUsersRequest =
  | {
      action: "create_user"
      email: string
      password: string
      displayName: string
    }
  | {
      action: "delete_user"
      userId: string
    }
  | {
      action: "list_subscriptions"
    }
  | {
      action: "get_subscription_stats"
    }
  | {
      action: "update_subscription"
      userId: string
      plan?: "free" | "premium"
      status?: "active" | "cancelled" | "suspended"
      amountPhp?: number
      nextBillingAt?: string | null
      endsAt?: string | null
      renewedAt?: string | null
    }

const PREMIUM_MONTHLY_PRICE_PHP = 299

function normalizePlan(value: unknown): "free" | "premium" | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "free" || normalized === "premium") {
    return normalized
  }
  return null
}

function normalizeStatus(value: unknown): "active" | "cancelled" | "suspended" | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "active" || normalized === "cancelled" || normalized === "suspended") {
    return normalized
  }
  return null
}

function parseOptionalIsoDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string" || !value.trim()) return undefined
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return undefined
  return new Date(timestamp).toISOString()
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

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null
  return authHeader.slice(7).trim() || null
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

    const { data: callerProfile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single()

    if (profileError || !callerProfile || callerProfile.role !== "admin") {
      return jsonResponse(403, { success: false, error: "Only admins can manage users" })
    }

    const body = (await req.json()) as Partial<ManageUsersRequest>
    const action = body.action

    if (action === "create_user") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
      const password = typeof body.password === "string" ? body.password : ""
      const displayName = typeof body.displayName === "string" ? body.displayName.trim() : ""

      if (!email || !email.includes("@")) {
        return jsonResponse(400, { success: false, error: "Valid email is required" })
      }

      if (password.length < 6) {
        return jsonResponse(400, { success: false, error: "Password must be at least 6 characters" })
      }

      if (displayName.length < 2) {
        return jsonResponse(400, { success: false, error: "Display name must be at least 2 characters" })
      }

      const { data: createdData, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError || !createdData.user) {
        return jsonResponse(400, { success: false, error: createError?.message || "Failed to create user" })
      }

      const createdUserId = createdData.user.id

      const { error: updateProfileError } = await serviceClient
        .from("user_profiles")
        .update({
          display_name: displayName,
          role: "student",
        })
        .eq("id", createdUserId)

      if (updateProfileError) {
        await serviceClient.auth.admin.deleteUser(createdUserId)
        return jsonResponse(500, { success: false, error: "User created but profile setup failed; rolled back" })
      }

      const { data: createdProfile } = await serviceClient
        .from("user_profiles")
        .select("id, email, display_name, role, has_completed_profiling, created_at, subscriptions(plan, status)")
        .eq("id", createdUserId)
        .single()

      return jsonResponse(200, {
        success: true,
        data: {
          id: createdUserId,
          email: createdProfile?.email ?? email,
          display_name: createdProfile?.display_name ?? displayName,
          role: createdProfile?.role ?? "student",
          has_completed_profiling: createdProfile?.has_completed_profiling ?? false,
          created_at: createdProfile?.created_at ?? new Date().toISOString(),
          subscription_plan:
            normalizePlan((createdProfile as { subscriptions?: Array<{ plan?: string }> })?.subscriptions?.[0]?.plan) ??
            "free",
          subscription_status:
            normalizeStatus((createdProfile as { subscriptions?: Array<{ status?: string }> })?.subscriptions?.[0]?.status) ??
            "active",
        },
      })
    }

    if (action === "delete_user") {
      const userId = typeof body.userId === "string" ? body.userId.trim() : ""
      if (!userId) {
        return jsonResponse(400, { success: false, error: "User ID is required" })
      }

      if (userId === callerUser.id) {
        return jsonResponse(400, { success: false, error: "You cannot delete your own account from this panel" })
      }

      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId)
      if (deleteError) {
        return jsonResponse(400, { success: false, error: deleteError.message || "Failed to delete user" })
      }

      return jsonResponse(200, { success: true, data: { userId } })
    }

    if (action === "list_subscriptions") {
      const { data, error } = await serviceClient
        .from("subscriptions")
        .select(
          "user_id, plan, status, amount_php, currency, started_at, next_billing_at, ends_at, renewed_at, user_profiles!inner(display_name, email)"
        )
        .order("started_at", { ascending: false })

      if (error) {
        return jsonResponse(500, { success: false, error: error.message || "Failed to list subscriptions" })
      }

      const mapped = (data ?? []).map((row) => {
        const userProfile = row.user_profiles as { display_name: string | null; email: string | null } | null
        return {
          userId: row.user_id,
          userName: userProfile?.display_name?.trim() || userProfile?.email || "Unknown User",
          email: userProfile?.email || "No email",
          plan: normalizePlan(row.plan) ?? "free",
          status: normalizeStatus(row.status) ?? "active",
          amountPhp: row.amount_php ?? 0,
          currency: row.currency ?? "PHP",
          startedAt: row.started_at,
          nextBillingAt: row.next_billing_at,
          endsAt: row.ends_at,
          renewedAt: row.renewed_at,
        }
      })

      return jsonResponse(200, { success: true, data: mapped })
    }

    if (action === "get_subscription_stats") {
      const { data, error } = await serviceClient
        .from("subscriptions")
        .select("plan, status, amount_php")

      if (error) {
        return jsonResponse(500, { success: false, error: error.message || "Failed to fetch subscription stats" })
      }

      const rows = data ?? []
      const activeSubscriptions = rows.filter((row) => normalizeStatus(row.status) === "active").length
      const premiumUsers = rows.filter(
        (row) => normalizePlan(row.plan) === "premium" && normalizeStatus(row.status) === "active"
      ).length
      const estimatedMonthlyRevenuePhp = rows
        .filter((row) => normalizePlan(row.plan) === "premium" && normalizeStatus(row.status) === "active")
        .reduce((sum, row) => sum + (row.amount_php ?? PREMIUM_MONTHLY_PRICE_PHP), 0)

      return jsonResponse(200, {
        success: true,
        data: {
          activeSubscriptions,
          premiumUsers,
          estimatedMonthlyRevenuePhp,
        },
      })
    }

    if (action === "update_subscription") {
      const userId = typeof body.userId === "string" ? body.userId.trim() : ""
      if (!userId) {
        return jsonResponse(400, { success: false, error: "User ID is required" })
      }

      const hasPlan = Object.prototype.hasOwnProperty.call(body, "plan")
      const hasStatus = Object.prototype.hasOwnProperty.call(body, "status")
      const hasNextBillingAt = Object.prototype.hasOwnProperty.call(body, "nextBillingAt")
      const hasEndsAt = Object.prototype.hasOwnProperty.call(body, "endsAt")
      const hasRenewedAt = Object.prototype.hasOwnProperty.call(body, "renewedAt")

      const plan = hasPlan ? normalizePlan(body.plan) : null
      const status = hasStatus ? normalizeStatus(body.status) : null
      const amountPhp =
        typeof body.amountPhp === "number" && Number.isFinite(body.amountPhp) && body.amountPhp >= 0
          ? Math.round(body.amountPhp)
          : undefined
      const nextBillingAt = parseOptionalIsoDate(body.nextBillingAt)
      const endsAt = parseOptionalIsoDate(body.endsAt)
      const renewedAt = parseOptionalIsoDate(body.renewedAt)

      if ((hasPlan && plan === null) || (hasStatus && status === null)) {
        return jsonResponse(400, { success: false, error: "Invalid subscription payload" })
      }
      if ((hasNextBillingAt && nextBillingAt === undefined) || (hasEndsAt && endsAt === undefined) || (hasRenewedAt && renewedAt === undefined)) {
        return jsonResponse(400, { success: false, error: "Invalid date payload in subscription update" })
      }

      const patch: Record<string, unknown> = {}
      if (hasPlan && plan) patch.plan = plan
      if (hasStatus && status) patch.status = status
      if (amountPhp !== undefined) {
        patch.amount_php = amountPhp
      } else if (hasPlan && plan) {
        patch.amount_php = plan === "premium" ? PREMIUM_MONTHLY_PRICE_PHP : 0
      }
      if (hasNextBillingAt) patch.next_billing_at = nextBillingAt ?? null
      if (hasEndsAt) patch.ends_at = endsAt ?? null
      if (hasRenewedAt) patch.renewed_at = renewedAt ?? null

      if (Object.keys(patch).length === 0) {
        return jsonResponse(400, { success: false, error: "No subscription fields provided to update" })
      }

      const { data, error } = await serviceClient
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            plan: "free",
            status: "active",
            amount_php: 0,
            currency: "PHP",
            started_at: new Date().toISOString(),
            ...patch,
          },
          { onConflict: "user_id" }
        )
        .select(
          "user_id, plan, status, amount_php, currency, started_at, next_billing_at, ends_at, renewed_at, user_profiles!inner(display_name, email)"
        )
        .single()

      if (error || !data) {
        return jsonResponse(500, { success: false, error: error?.message || "Failed to update subscription" })
      }

      const userProfile = data.user_profiles as { display_name: string | null; email: string | null } | null
      return jsonResponse(200, {
        success: true,
        data: {
          userId: data.user_id,
          userName: userProfile?.display_name?.trim() || userProfile?.email || "Unknown User",
          email: userProfile?.email || "No email",
          plan: normalizePlan(data.plan) ?? "free",
          status: normalizeStatus(data.status) ?? "active",
          amountPhp: data.amount_php ?? 0,
          currency: data.currency ?? "PHP",
          startedAt: data.started_at,
          nextBillingAt: data.next_billing_at,
          endsAt: data.ends_at,
          renewedAt: data.renewed_at,
        },
      })
    }

    return jsonResponse(400, { success: false, error: "Unsupported action" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return jsonResponse(500, { success: false, error: message })
  }
})
