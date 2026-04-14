import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ensureFreshSession, supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { AppUserRole } from "@/lib/authRouting"
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/subscription"

export interface AdminUserProfile {
  id: string
  email: string | null
  display_name: string | null
  role: AppUserRole
  has_completed_profiling: boolean
  created_at: string
  subscription_plan: SubscriptionPlan
  subscription_status: SubscriptionStatus
}

interface AdminCreateUserInput {
  displayName: string
  email: string
  password: string
}

interface AdminFunctionSuccess<T> {
  success: true
  data: T
}

interface AdminFunctionError {
  success: false
  error: string
}

type AdminFunctionResponse<T> = AdminFunctionSuccess<T> | AdminFunctionError

export const adminUserKeys = {
  all: ["admin-users"] as const,
  list: () => [...adminUserKeys.all, "list"] as const,
}

export function useAdminUsers() {
  const { user, profile } = useAuth()

  return useQuery({
    queryKey: adminUserKeys.list(),
    queryFn: async ({ signal }): Promise<AdminUserProfile[]> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, display_name, role, has_completed_profiling, created_at, subscriptions(plan, status)")
        .order("created_at", { ascending: false })
        .abortSignal(signal)

      if (error) {
        throw new Error(error.message)
      }

      return (data ?? []).map((row) => {
        const subscription = Array.isArray(row.subscriptions) ? row.subscriptions[0] : row.subscriptions
        const plan = subscription?.plan === "premium" ? "premium" : "free"
        const status =
          subscription?.status === "cancelled" || subscription?.status === "suspended"
            ? subscription.status
            : "active"

        return {
          id: row.id,
          email: row.email,
          display_name: row.display_name,
          role: row.role,
          has_completed_profiling: row.has_completed_profiling,
          created_at: row.created_at,
          subscription_plan: plan,
          subscription_status: status,
        }
      })
    },
    enabled: !!user && profile?.role === "admin",
  })
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: AdminCreateUserInput): Promise<AdminUserProfile> => {
      const session = await ensureFreshSession()
      if (!session) {
        throw new Error("Your session has expired — please log in again")
      }

      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "create_user",
          email: input.email,
          password: input.password,
          displayName: input.displayName,
        },
      })

      if (error) {
        throw new Error(error.message || "Failed to create user")
      }

      const payload = data as AdminFunctionResponse<AdminUserProfile>
      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to create user")
      }

      return payload.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.list() })
    },
  })
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string): Promise<{ userId: string }> => {
      const session = await ensureFreshSession()
      if (!session) {
        throw new Error("Your session has expired — please log in again")
      }

      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "delete_user",
          userId,
        },
      })

      if (error) {
        throw new Error(error.message || "Failed to delete user")
      }

      const payload = data as AdminFunctionResponse<{ userId: string }>
      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to delete user")
      }

      return payload.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.list() })
    },
  })
}
