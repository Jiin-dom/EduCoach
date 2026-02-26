**The Problem:** After leaving the app idle for ~3 minutes (backgrounding the tab), file uploads would hang forever and eventually timeout.

**Root Cause:** Supabase's auth client uses the browser's **Web Locks API** (`navigator.locks.request()`) to serialize access to the session token. When the tab is backgrounded, the OS kills idle HTTP connections. If a token refresh was in-flight when this happens, the Web Lock callback never resolves - creating a **zombie lock**. Every subsequent `getSession()` call (which happens inside `supabase.storage.upload()`, `supabase.from().insert()`, and virtually every authenticated operation) deadlocks waiting for that zombie lock.

**The Fix (3 parts across 2 files):**

1. **`supabase.ts` - Custom lock with timeout** (`lockWithTimeout`): Replaces Supabase's default Web Lock implementation. If the lock can't be acquired within the timeout period, it falls back to executing without the lock. This fixes ALL Supabase operations (queries, inserts, uploads, etc.) in one shot.

2. **`storage.ts` - Raw fetch upload** (`uploadWithTimeout` + `getAccessTokenDirect`): Bypasses the Supabase JS client entirely for file uploads. Reads the auth token directly from `localStorage` and makes a raw `fetch()` to the storage API. Uses `AbortSignal.timeout()` for proper request cancellation (unlike `Promise.race` which leaves orphaned requests). Belt-and-suspenders with fix #1.

3. **`supabase.ts` + `storage.ts` - Storage endpoint warming**: Now warms both `/rest/v1/` (database) AND `/storage/v1/` (file storage) connections on tab visibility change and before uploads. The old code only warmed the REST endpoint, leaving storage connections potentially dead.