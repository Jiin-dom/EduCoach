// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const body = (await req.json()) as { email?: string; newPassword?: string }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

    if (!email || !email.includes("@")) {
      return jsonResponse(400, { success: false, error: "Valid email is required" })
    }

    if (newPassword.length < 8) {
      return jsonResponse(400, { success: false, error: "Password must be at least 8 characters" })
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle()

    if (profileError) {
      return jsonResponse(500, { success: false, error: "Failed to verify email" })
    }

    if (!profile?.id) {
      return jsonResponse(404, { success: false, error: "Email is not registered" })
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    })

    if (updateError) {
      return jsonResponse(400, { success: false, error: updateError.message || "Failed to reset password" })
    }

    return jsonResponse(200, { success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return jsonResponse(500, { success: false, error: message })
  }
})
