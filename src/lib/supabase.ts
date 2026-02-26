import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

// ---------------------------------------------------------------------------
// JWT / localStorage helpers — token validation and stale session cleanup.
// ---------------------------------------------------------------------------

/** Computes the localStorage key Supabase uses to persist the auth session. */
export function getSupabaseStorageKey(): string {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
    return `sb-${projectRef}-auth-token`
}

/**
 * Decodes a JWT and checks whether it has expired.
 * Returns true if expired or unparseable. Uses a 60-second buffer so tokens
 * expiring within the next minute are treated as already expired.
 */
export function isTokenExpired(jwt: string): boolean {
    try {
        const payload = JSON.parse(atob(jwt.split('.')[1]))
        const exp = payload.exp
        if (typeof exp !== 'number') return true
        return Date.now() >= (exp - 60) * 1000
    } catch {
        return true
    }
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
        await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'HEAD',
            headers: { apikey: supabaseAnonKey },
            signal: AbortSignal.timeout(5000),
        })
        console.log('[Auth] 🏓 Connection warmer: socket is alive')
    } catch {
        console.log('[Auth] 🏓 Connection warmer: stale socket detected, browser will use fresh connection')
    }
}

// ---------------------------------------------------------------------------
// Resilient fetch wrapper — adds timeout + automatic retry to ALL Supabase
// client HTTP requests.
//
// WHY: The Supabase JS client's internal fetch() has NO timeout. After the
// browser tab is backgrounded for >5 minutes, the OS kills idle HTTP/2
// connections. The browser doesn't know the socket is dead, so fetch()
// hangs FOREVER — getSession() doesn't even get called because the client
// caches the access token. This means the Web Lock timeout is irrelevant;
// the raw HTTP request is what hangs.
//
// React Query's refetchOnWindowFocus fires at the same time as our
// visibilitychange warm-up (within ~10ms), so the refetch request is
// already in-flight on the dead socket before the warm-up can fix it.
//
// This wrapper catches the hang at the source: if ANY Supabase request
// takes longer than SUPABASE_FETCH_TIMEOUT_MS, it aborts, warms the
// connection to force the browser to create a fresh socket, and retries.
// ---------------------------------------------------------------------------
const SUPABASE_FETCH_TIMEOUT_MS = 15_000

async function resilientFetch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const attempt = async (signal: AbortSignal): Promise<Response> => {
        return globalThis.fetch(input, { ...init, signal })
    }

    const makeTimeoutController = (): { controller: AbortController; cleanup: () => void } => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS)

        if (init?.signal) {
            const onCallerAbort = () => controller.abort()
            init.signal.addEventListener('abort', onCallerAbort, { once: true })
            return {
                controller,
                cleanup: () => {
                    clearTimeout(timeoutId)
                    init.signal?.removeEventListener('abort', onCallerAbort)
                },
            }
        }

        return { controller, cleanup: () => clearTimeout(timeoutId) }
    }

    const first = makeTimeoutController()
    try {
        const response = await attempt(first.controller.signal)
        first.cleanup()
        return response
    } catch (err) {
        first.cleanup()

        if (init?.signal?.aborted) throw err

        if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
            console.warn('[Supabase] ⏰ Request timed out after', SUPABASE_FETCH_TIMEOUT_MS / 1000, 's — warming connection and retrying…')
            await warmConnection()

            const retry = makeTimeoutController()
            try {
                const response = await attempt(retry.controller.signal)
                retry.cleanup()
                console.log('[Supabase] ✅ Retry succeeded')
                return response
            } catch (retryErr) {
                retry.cleanup()
                throw retryErr
            }
        }

        throw err
    }
}

// ---------------------------------------------------------------------------
// Supabase client — configured with:
//   1. Custom Web Lock timeout (prevents getSession deadlocks)
//   2. Resilient global fetch (prevents dead-socket hangs on ALL operations)
// ---------------------------------------------------------------------------
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        lock: lockWithTimeout,
    },
    global: {
        fetch: resilientFetch,
    },
})

// ---------------------------------------------------------------------------
// Session management helpers.
// ---------------------------------------------------------------------------

/**
 * Removes stale Supabase auth data from localStorage.
 * Call this when the session is unrecoverable (expired refresh token,
 * corrupt storage, etc.) so the next app load starts clean.
 */
export function clearStaleSession(): void {
    try {
        const key = getSupabaseStorageKey()
        const stored = localStorage.getItem(key)
        if (stored) {
            console.log('[Auth] Clearing stale session from localStorage')
            localStorage.removeItem(key)
        }
    } catch (err) {
        console.warn('[Auth] Failed to clear stale session:', err)
    }
}

/**
 * Deduplicated session refresh — adapted from Nuzzle's isRefreshing + failedQueue
 * pattern. Only ONE getSession() call runs at a time; concurrent callers await
 * the same promise. Returns the session on success, null on failure.
 */
let _refreshPromise: Promise<Session | null> | null = null

export async function ensureFreshSession(): Promise<Session | null> {
    if (_refreshPromise) {
        return _refreshPromise
    }

    _refreshPromise = (async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession()
            if (error) {
                console.error('[Auth] Session refresh failed:', error.message)
                return null
            }
            if (!session) {
                console.warn('[Auth] No session after refresh attempt')
                return null
            }
            if (isTokenExpired(session.access_token)) {
                console.warn('[Auth] Access token still expired after getSession() — session unrecoverable')
                clearStaleSession()
                return null
            }
            return session
        } catch (err) {
            console.error('[Auth] ensureFreshSession threw:', err)
            return null
        } finally {
            _refreshPromise = null
        }
    })()

    return _refreshPromise
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
