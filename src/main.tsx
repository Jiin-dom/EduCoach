import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './index.css'
import App from './App.tsx'

// ---------------------------------------------------------------------------
// Helper: detect if a React Query error is an auth / stale-token error.
// ---------------------------------------------------------------------------
function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes('jwt expired') ||
      msg.includes('invalid jwt') ||
      msg.includes('auth session missing') ||
      msg.includes('not authenticated') ||
      msg.includes('invalid claim') ||
      msg.includes('token is expired')
    ) {
      return true
    }
  }

  // Supabase errors sometimes carry a status code
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return true

  return false
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2, // one extra retry so the auth-refresh-then-retry pattern works
    },
  },
})

// ---------------------------------------------------------------------------
// Global query error handler.
//
// If ANY React Query fetch fails with an auth error (expired JWT, missing
// session, etc.), we proactively call getSession() which refreshes the token
// behind the scenes.  React Query's built-in retry will then re-run the
// failed query with the fresh token — no manual page refresh needed.
// ---------------------------------------------------------------------------
queryClient.getQueryCache().config.onError = (error, query) => {
  if (isAuthError(error)) {
    console.warn(
      '[QueryClient] 🔑 Auth error detected, refreshing session...',
      { queryKey: query.queryKey, error: (error as Error).message }
    )
    // Fire-and-forget: getSession() will trigger onAuthStateChange with
    // TOKEN_REFRESHED, which in turn invalidates all caches (see AuthContext).
    supabase.auth.getSession()
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
