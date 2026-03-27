import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/contexts/AuthContext"
import { ensureFreshSession, supabase } from "@/lib/supabase"

interface StudentSubscriptionApiSuccess<T> {
  success: true
  data: T
}

interface StudentSubscriptionApiError {
  success: false
  error: string
}

type StudentSubscriptionApiResponse<T> = StudentSubscriptionApiSuccess<T> | StudentSubscriptionApiError

export interface StudentSubscriptionSnapshot {
  userId: string
  plan: "free" | "premium"
  status: "active" | "cancelled" | "suspended"
  amountPhp: number
  currency: string
  startedAt: string
  nextBillingAt: string | null
  endsAt: string | null
  renewedAt: string | null
  trialStartedAt: string | null
  trialEndsAt: string | null
  isTrialActive: boolean
  trialDaysLeft: number
  hasPremiumEntitlement: boolean
}

export const studentSubscriptionKeys = {
  all: ["student-subscription"] as const,
  me: () => [...studentSubscriptionKeys.all, "me"] as const,
}

export function useStudentSubscription() {
  const { user } = useAuth()

  return useQuery({
    queryKey: studentSubscriptionKeys.me(),
    queryFn: async (): Promise<StudentSubscriptionSnapshot> => {
      const session = await ensureFreshSession()
      if (!session) {
        throw new Error("Your session has expired — please log in again")
      }

      const { data, error } = await supabase.functions.invoke("student-subscription", {
        body: { action: "get_my_subscription" },
      })

      if (error) {
        throw new Error(error.message || "Failed to load subscription")
      }

      const payload = data as StudentSubscriptionApiResponse<StudentSubscriptionSnapshot>
      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to load subscription")
      }

      return payload.data
    },
    enabled: !!user,
  })
}

export function useMockSubscribePremium() {
  const queryClient = useQueryClient()
  const { user, refreshProfile } = useAuth()

  return useMutation({
    mutationFn: async (): Promise<StudentSubscriptionSnapshot> => {
      const session = await ensureFreshSession()
      if (!session) {
        throw new Error("Your session has expired — please log in again")
      }

      const { data, error } = await supabase.functions.invoke("student-subscription", {
        body: { action: "mock_subscribe_premium" },
      })

      if (error) {
        throw new Error(error.message || "Failed to upgrade subscription")
      }

      const payload = data as StudentSubscriptionApiResponse<StudentSubscriptionSnapshot>
      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to upgrade subscription")
      }

      return payload.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: studentSubscriptionKeys.me() })
      if (user) {
        await refreshProfile()
      }
    },
  })
}
