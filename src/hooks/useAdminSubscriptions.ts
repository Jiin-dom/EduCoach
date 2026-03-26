import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ensureFreshSession, supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { adminUserKeys } from "@/hooks/useAdminUsers"
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/subscription"

export interface AdminManagedSubscription {
  userId: string
  userName: string
  email: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  amountPhp: number
  currency: string
  startedAt: string
  nextBillingAt: string | null
  endsAt: string | null
  renewedAt: string | null
}

export interface AdminSubscriptionStats {
  activeSubscriptions: number
  premiumUsers: number
  estimatedMonthlyRevenuePhp: number
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

interface UpdateSubscriptionInput {
  userId: string
  plan?: SubscriptionPlan
  status?: SubscriptionStatus
  amountPhp?: number
  nextBillingAt?: string | null
  endsAt?: string | null
  renewedAt?: string | null
}

export const adminSubscriptionKeys = {
  all: ["admin-subscriptions"] as const,
  list: () => [...adminSubscriptionKeys.all, "list"] as const,
  stats: () => [...adminSubscriptionKeys.all, "stats"] as const,
}

export function useAdminSubscriptions() {
  const { user, profile } = useAuth()

  return useQuery({
    queryKey: adminSubscriptionKeys.list(),
    queryFn: async (): Promise<AdminManagedSubscription[]> => {
      const session = await ensureFreshSession()
      if (!session) {
        throw new Error("Your session has expired — please log in again")
      }

      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list_subscriptions" },
      })

      if (error) {
        throw new Error(error.message || "Failed to load subscriptions")
      }

      const payload = data as AdminFunctionResponse<AdminManagedSubscription[]>
      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to load subscriptions")
      }

      return payload.data
    },
    enabled: !!user && profile?.role === "admin",
  })
}

export function useAdminSubscriptionStats() {
  const { user, profile } = useAuth()

  return useQuery({
    queryKey: adminSubscriptionKeys.stats(),
    queryFn: async (): Promise<AdminSubscriptionStats> => {
      const session = await ensureFreshSession()
      if (!session) {
        throw new Error("Your session has expired — please log in again")
      }

      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "get_subscription_stats" },
      })

      if (error) {
        throw new Error(error.message || "Failed to load subscription stats")
      }

      const payload = data as AdminFunctionResponse<AdminSubscriptionStats>
      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to load subscription stats")
      }

      return payload.data
    },
    enabled: !!user && profile?.role === "admin",
  })
}

export function useUpdateAdminSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateSubscriptionInput): Promise<AdminManagedSubscription> => {
      const session = await ensureFreshSession()
      if (!session) {
        throw new Error("Your session has expired — please log in again")
      }

      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "update_subscription",
          userId: input.userId,
          plan: input.plan,
          status: input.status,
          amountPhp: input.amountPhp,
          nextBillingAt: input.nextBillingAt,
          endsAt: input.endsAt,
          renewedAt: input.renewedAt,
        },
      })

      if (error) {
        throw new Error(error.message || "Failed to update subscription")
      }

      const payload = data as AdminFunctionResponse<AdminManagedSubscription>
      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to update subscription")
      }

      return payload.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSubscriptionKeys.list() })
      queryClient.invalidateQueries({ queryKey: adminSubscriptionKeys.stats() })
      queryClient.invalidateQueries({ queryKey: adminUserKeys.list() })
    },
  })
}
