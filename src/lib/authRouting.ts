import { DEFAULT_RETURN_PATH } from "@/lib/oauthRedirect"

export type AppUserRole = "student" | "admin"

interface PostLoginDestinationInput {
  role: AppUserRole
  hasCompletedProfiling: boolean
  fromPath: string
  oauthReturnPath?: string | null
}

/**
 * Centralized post-login routing rules.
 * Admin always lands on admin pages; student users follow onboarding/app flow.
 */
export function getPostLoginDestination({
  role,
  hasCompletedProfiling,
  fromPath,
  oauthReturnPath,
}: PostLoginDestinationInput): string {
  if (role === "admin") return "/admin/users"
  if (!hasCompletedProfiling) return "/profiling"

  if (oauthReturnPath && oauthReturnPath !== DEFAULT_RETURN_PATH) {
    return oauthReturnPath
  }

  return fromPath
}
