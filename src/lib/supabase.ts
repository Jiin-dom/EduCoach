import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

// ---------------------------------------------------------------------------
// Custom Web Lock implementation with timeout fallback.
//
// WHY: Supabase's auth client uses `navigator.locks.request()` to serialise
// access to the session token. When the browser tab is backgrounded, the OS
// kills idle HTTP connections. If a token refresh was in progress, the lock
// is held by a zombie callback that never resolves. Every subsequent
// getSession() call (including those inside storage.upload(), .from().insert(),
// etc.) then deadlocks waiting for the zombie lock — forever.
//
// This custom lock tries `navigator.locks.request()` with an AbortSignal
// timeout. If the lock can't be acquired within `acquireTimeout` ms, we
// execute the callback WITHOUT the lock. A brief lock-free window is vastly
// preferable to a permanent deadlock that freezes all Supabase operations.
// ---------------------------------------------------------------------------
async function lockWithTimeout<R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> {
    if (typeof navigator === 'undefined' || !navigator.locks) {
        return fn()
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), acquireTimeout)

    try {
        return await navigator.locks.request(
            name,
            { signal: controller.signal },
            async () => {
                clearTimeout(timeoutId)
                return fn()
            }
        )
    } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof DOMException && err.name === 'AbortError') {
            console.warn('[Auth] Web Lock acquire timed out — executing without lock')
            return fn()
        }
        throw err
    }
}

// ---------------------------------------------------------------------------
// Supabase client — configured with our custom lock to prevent deadlocks.
// ---------------------------------------------------------------------------
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        lock: lockWithTimeout,
    },
})

// ---------------------------------------------------------------------------
// Connection warmer — detects and tears down dead TCP sockets.
//
// WHY: When a tab is backgrounded, the OS kills idle HTTP/2 connections.
// The browser doesn't know the socket is dead, so the next fetch() hangs.
// This lightweight ping forces the browser to test the connection and,
// if it's dead, establish a fresh one — BEFORE we call getSession() or
// fire any queries.
// ---------------------------------------------------------------------------
async function warmConnection(): Promise<void> {
    try {
        // A simple HEAD request to the PostgREST health-check endpoint.
        // We don't care about the response — we just need the browser to
        // either confirm the socket is alive or detect it's dead.
        await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'HEAD',
            headers: { apikey: supabaseAnonKey },
            signal: AbortSignal.timeout(5000), // 5 seconds max
        })
        console.log('[Auth] 🏓 Connection warmer: socket is alive')
    } catch {
        // Timeout or network error — this is expected on a dead connection.
        // The important thing: the browser now knows the socket is dead
        // and will create a fresh one for all subsequent requests.
        console.log('[Auth] 🏓 Connection warmer: stale socket detected, browser will use fresh connection')
    }
}

// ---------------------------------------------------------------------------
// Connection warmer when the browser tab regains focus.
//
// IMPORTANT: We ONLY warm the HTTP connection here. We do NOT call
// getSession(). Every Supabase request already calls getSession() internally
// (via _getAccessToken → fetchWithAuth). If WE call getSession() first, it
// acquires a Web Lock for up to 10 seconds (during token refresh), blocking
// ALL other Supabase requests (queries, uploads) that also need the lock.
//
// The warmer just ensures the TCP socket is alive so the NEXT real request
// (a React Query refetch, a storage upload, etc.) doesn't hang on the
// dead connection when IT calls getSession() internally.
// ---------------------------------------------------------------------------

let lastVisibilityRefresh = 0
const VISIBILITY_DEBOUNCE_MS = 3000

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return

    const now = Date.now()
    if (now - lastVisibilityRefresh < VISIBILITY_DEBOUNCE_MS) return
    lastVisibilityRefresh = now

    console.log('[Auth] 👀 Tab became visible, warming connection...')

    await warmConnection()

    try {
        await fetch(`${supabaseUrl}/storage/v1/`, {
            method: 'HEAD',
            headers: { apikey: supabaseAnonKey },
            signal: AbortSignal.timeout(5000),
        })
        console.log('[Auth] 🏓 Storage connection warmed')
    } catch {
        console.log('[Auth] 🏓 Storage stale socket detected on visibility')
    }
})
