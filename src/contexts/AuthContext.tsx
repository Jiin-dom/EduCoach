import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, clearStaleSession, getSupabaseStorageKey } from '@/lib/supabase'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

interface UserProfile {
    id: string
    email: string | null
    display_name: string | null
    avatar_url: string | null
    learning_style: string | null
    study_goal: string | null
    preferred_subjects: string[] | null
    daily_study_minutes: number
    has_completed_profiling: boolean
}

interface AuthContextType {
    user: User | null
    profile: UserProfile | null
    session: Session | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null; profile: UserProfile | null }>
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    // Fetch user profile from database
    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (error) {
            console.error('Error fetching profile:', error)
            return null
        }
        return data as UserProfile
    }

    const queryClient = useQueryClient()
    const initHandledRef = useRef(false)
    const fetchProfileInFlightRef = useRef(false)

    useEffect(() => {
        // -----------------------------------------------------------------
        // 1. Initial session restoration — with .catch() and a hard timeout
        //    so the loading screen never hangs. After idle or on a dead
        //    connection, getSession() can wait for the Web Lock + HTTP
        //    retry for up to 30s. The 10s ceiling keeps the UX responsive.
        // -----------------------------------------------------------------
        const INIT_TIMEOUT_MS = 10_000

        Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Initial getSession timeout')), INIT_TIMEOUT_MS)
            ),
        ])
            .then(({ data: { session: initialSession } }) => {
                setSession(initialSession)
                setUser(initialSession?.user ?? null)

                if (initialSession?.user) {
                    const expiresAt = initialSession.expires_at
                        ? new Date(initialSession.expires_at * 1000)
                        : null
                    console.log('[Auth] Session loaded on init', {
                        userId: initialSession.user.id.slice(0, 8) + '...',
                        expiresAt: expiresAt?.toLocaleTimeString() ?? 'unknown',
                    })
                    fetchProfile(initialSession.user.id).then(setProfile)
                } else {
                    console.log('[Auth] No session on init')
                    try {
                        const key = getSupabaseStorageKey()
                        if (localStorage.getItem(key)) {
                            clearStaleSession()
                        }
                    } catch { /* localStorage unavailable */ }
                }

                initHandledRef.current = true
                setLoading(false)
            })
            .catch((err) => {
                console.error('[Auth] getSession() failed on init:', err)
                clearStaleSession()
                setSession(null)
                setUser(null)
                setProfile(null)
                initHandledRef.current = true
                setLoading(false)
            })

        // -----------------------------------------------------------------
        // 2. Auth state change listener — handles SIGNED_IN, TOKEN_REFRESHED,
        //    SIGNED_OUT, etc. We skip INITIAL_SESSION because getSession()
        //    above already handled init (prevents double fetchProfile).
        //
        //    fetchProfile is protected with:
        //    - A 5s timeout (dead connections can hang for 15-30s)
        //    - A dedup guard (visibility change fires SIGNED_IN 2+ times)
        // -----------------------------------------------------------------
        const PROFILE_FETCH_TIMEOUT_MS = 5_000

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, newSession: Session | null) => {
                if (event === 'INITIAL_SESSION') {
                    return
                }

                console.log(`[Auth] Auth state change: ${event}`, {
                    hasSession: !!newSession,
                    userId: newSession?.user?.id?.slice(0, 8) ?? 'none',
                    expiresAt: newSession?.expires_at
                        ? new Date(newSession.expires_at * 1000).toLocaleTimeString()
                        : 'n/a',
                })

                setSession(newSession)
                setUser(newSession?.user ?? null)

                if (newSession?.user) {
                    if (!fetchProfileInFlightRef.current) {
                        fetchProfileInFlightRef.current = true
                        try {
                            const userProfile = await Promise.race([
                                fetchProfile(newSession.user.id),
                                new Promise<null>((resolve) =>
                                    setTimeout(() => resolve(null), PROFILE_FETCH_TIMEOUT_MS)
                                ),
                            ])
                            if (userProfile) setProfile(userProfile)
                        } catch {
                            // Non-critical: profile will be fetched on next event
                        } finally {
                            fetchProfileInFlightRef.current = false
                        }
                    }
                } else {
                    setProfile(null)
                }

                if (event === 'TOKEN_REFRESHED') {
                    console.log('[Auth] Token refreshed — invalidating query caches')
                    queryClient.invalidateQueries()
                }

                if (event === 'SIGNED_OUT') {
                    console.log('[Auth] Signed out — clearing all cached data')
                    queryClient.clear()
                    clearStaleSession()
                }

                setLoading(false)
            }
        )

        // -----------------------------------------------------------------
        // 3. Session-expired event listener — dispatched by main.tsx when
        //    ensureFreshSession() fails. Triggers full local logout so the
        //    user is sent back to the login screen cleanly.
        //    (Adapted from Nuzzle's 'auth-expired' DOM event pattern.)
        // -----------------------------------------------------------------
        const handleSessionExpired = () => {
            console.log('[Auth] Session expired event received — performing full logout')
            supabase.auth.signOut().catch(() => {})
            setUser(null)
            setProfile(null)
            setSession(null)
            queryClient.clear()
            clearStaleSession()
        }
        window.addEventListener('educoach-session-expired', handleSessionExpired)

        return () => {
            subscription.unsubscribe()
            window.removeEventListener('educoach-session-expired', handleSessionExpired)
        }
    }, [queryClient])

    const signIn = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            return { error: error as Error | null, profile: null }
        }

        // Fetch profile with a 5-second timeout. The onAuthStateChange handler
        // (SIGNED_IN) also fetches the profile concurrently, so if this times
        // out the context will still get the profile shortly after. Without this
        // timeout, Web Lock contention from the concurrent TOKEN_REFRESHED
        // handler can cause fetchProfile to hang, freezing the login button.
        let userProfile: UserProfile | null = null
        if (data.user) {
            try {
                userProfile = await Promise.race([
                    fetchProfile(data.user.id),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
                ])
            } catch {
                // onAuthStateChange handler will set profile as a fallback
            }
            if (userProfile) setProfile(userProfile)
        }

        return { error: null, profile: userProfile }
    }

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password })
        return { error: error as Error | null }
    }

    const signOut = async () => {
        // Clear local state FIRST so the UI updates instantly. The server-side
        // signout (token revocation) runs in the background. If we awaited
        // supabase.auth.signOut() first, a dead TCP connection could freeze the
        // logout button for 15+ seconds.
        setUser(null)
        setProfile(null)
        setSession(null)
        queryClient.clear()
        clearStaleSession()

        supabase.auth.signOut().catch((err) => {
            console.warn('[Auth] Server-side signOut failed (local state already cleared):', err)
        })
    }

    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!user) return { error: new Error('Not authenticated') }

        const { error } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('id', user.id)

        if (!error) {
            // Refresh profile after update
            const updatedProfile = await fetchProfile(user.id)
            setProfile(updatedProfile)
        }

        return { error: error as Error | null }
    }

    const value = {
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
