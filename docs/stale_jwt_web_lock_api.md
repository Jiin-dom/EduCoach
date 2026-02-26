**Problem #1 (fixed earlier):** After leaving the app idle for ~3 minutes (backgrounding the tab), file uploads would hang forever and eventually timeout.

**Root Cause #1:** Supabase's auth client uses the browser's **Web Locks API** (`navigator.locks.request()`) to serialize access to the session token. When the tab is backgrounded, the OS kills idle HTTP connections. If a token refresh was in-flight when this happens, the Web Lock callback never resolves - creating a **zombie lock**. Every subsequent `getSession()` call (which happens inside `supabase.storage.upload()`, `supabase.from().insert()`, and virtually every authenticated operation) deadlocks waiting for that zombie lock.

**Fix #1 (3 parts across 2 files):**

1. **`supabase.ts` - Custom lock with timeout** (`lockWithTimeout`): Replaces Supabase's default Web Lock implementation. If the lock can't be acquired within the timeout period, it falls back to executing without the lock. This fixes ALL Supabase operations (queries, inserts, uploads, etc.) in one shot.

2. **`storage.ts` - Raw fetch upload** (`uploadWithTimeout` + `getAccessTokenDirect`): Bypasses the Supabase JS client entirely for file uploads. Reads the auth token directly from `localStorage` and makes a raw `fetch()` to the storage API. Uses `AbortSignal.timeout()` for proper request cancellation (unlike `Promise.race` which leaves orphaned requests). Belt-and-suspenders with fix #1.

3. **`supabase.ts` + `storage.ts` - Storage endpoint warming**: Now warms both `/rest/v1/` (database) AND `/storage/v1/` (file storage) connections on tab visibility change and before uploads. The old code only warmed the REST endpoint, leaving storage connections potentially dead.

---

**Problem #2 (fixed Feb 26 2026):** After leaving the app idle for >5 minutes, database operations (inserts, queries) via the Supabase JS client hang forever, even though storage uploads (raw fetch) succeed.

**Root Cause #2:** The Supabase JS client's internal `fetch()` has **NO timeout**. After 5+ minutes idle, the OS kills idle HTTP/2 connections. The browser doesn't know the socket is dead, so `fetch()` hangs forever. The Web Lock timeout from Fix #1 is irrelevant here because the client **caches the access token** — `getSession()` isn't even called when the token is still valid. The raw HTTP request itself is what hangs. Additionally, React Query's `refetchOnWindowFocus` fires within ~10ms of the `visibilitychange` event, **racing** the connection warm-up — the refetch is already in-flight on the dead socket before the warm-up can detect/replace it.

**Fix #2 (`supabase.ts` - `resilientFetch` global wrapper):** A custom `fetch` function passed via `global.fetch` to the Supabase client constructor. It wraps **every** HTTP request (queries, inserts, auth, edge functions) with a 15-second timeout. If the request hangs (dead socket), it aborts, calls `warmConnection()` to force the browser to tear down the dead socket, and retries once. If the caller (e.g., React Query) provides its own `AbortSignal`, both signals are respected — the caller's abort is never retried (intentional cancellation), only timeouts trigger a retry. This single wrapper fixes all Supabase client operations universally.
