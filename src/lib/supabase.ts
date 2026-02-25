import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ---------------------------------------------------------------------------
// Proactive session refresh when the browser tab regains focus.
//
// WHY: Supabase JS refreshes the JWT via a setTimeout ~30s before expiry.
//      Browsers throttle timers in backgrounded tabs, so if the user leaves
//      the tab for longer than the JWT lifetime (default 1 hour) the timer
//      never fires, and every API call fails with a stale token until the
//      user manually refreshes the page.
//
//      By listening for `visibilitychange` we force a session check the
//      moment the user comes back.  `getSession()` will detect the expired
//      access_token and use the refresh_token to get a new one — silently.
// ---------------------------------------------------------------------------

let lastVisibilityRefresh = 0
const VISIBILITY_DEBOUNCE_MS = 3000 // Don't hammer Supabase if the user tab-switches rapidly

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return

    const now = Date.now()
    if (now - lastVisibilityRefresh < VISIBILITY_DEBOUNCE_MS) return
    lastVisibilityRefresh = now

    console.log('[Auth] 👀 Tab became visible, checking session...')

    supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
            console.warn('[Auth] ⚠️ Session check failed on visibility change:', error.message)
        } else if (session) {
            const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null
            console.log('[Auth] ✅ Session valid.', {
                expiresAt: expiresAt?.toLocaleTimeString() ?? 'unknown',
                userId: session.user.id.slice(0, 8) + '...',
            })
        } else {
            console.log('[Auth] 🚪 No active session (user is signed out)')
        }
    })
})
