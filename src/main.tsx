import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ensureFreshSession } from '@/lib/supabase'
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
// session, etc.), we call ensureFreshSession() which deduplicates concurrent
// refresh calls (only ONE getSession() runs at a time — Nuzzle pattern).
// On success the Supabase client fires TOKEN_REFRESHED, AuthContext
// invalidates caches, and React Query's built-in retry re-runs with the
// fresh token.  On failure we dispatch a DOM event so AuthContext can
// perform a full logout + redirect to login.
// ---------------------------------------------------------------------------
queryClient.getQueryCache().config.onError = (error, query) => {
  if (isAuthError(error)) {
    console.warn(
      '[QueryClient] Auth error detected, refreshing session...',
      { queryKey: query.queryKey, error: (error as Error).message }
    )
    ensureFreshSession().then((session) => {
      if (!session) {
        console.warn('[QueryClient] Session refresh failed — dispatching session-expired event')
        window.dispatchEvent(new Event('educoach-session-expired'))
      }
    })
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
