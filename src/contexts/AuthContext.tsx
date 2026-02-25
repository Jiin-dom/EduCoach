import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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

    // Initialize auth state
    const queryClient = useQueryClient()

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            setSession(initialSession)
            setUser(initialSession?.user ?? null)

            if (initialSession?.user) {
                const expiresAt = initialSession.expires_at
                    ? new Date(initialSession.expires_at * 1000)
                    : null
                console.log('[Auth] 🔑 Session loaded on init', {
                    userId: initialSession.user.id.slice(0, 8) + '...',
                    expiresAt: expiresAt?.toLocaleTimeString() ?? 'unknown',
                })
                fetchProfile(initialSession.user.id).then(setProfile)
            } else {
                console.log('[Auth] 🚪 No session on init')
            }

            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, newSession: Session | null) => {
                console.log(`[Auth] 🔄 Auth state change: ${event}`, {
                    hasSession: !!newSession,
                    userId: newSession?.user?.id?.slice(0, 8) ?? 'none',
                    expiresAt: newSession?.expires_at
                        ? new Date(newSession.expires_at * 1000).toLocaleTimeString()
                        : 'n/a',
                })

                setSession(newSession)
                setUser(newSession?.user ?? null)

                if (newSession?.user) {
                    const userProfile = await fetchProfile(newSession.user.id)
                    setProfile(userProfile)
                } else {
                    setProfile(null)
                }

                // When the token is refreshed, invalidate all React Query caches
                // so that subsequent fetches use the fresh access token.
                if (event === 'TOKEN_REFRESHED') {
                    console.log('[Auth] ♻️ Token refreshed — invalidating query caches')
                    queryClient.invalidateQueries()
                }

                setLoading(false)
            }
        )

        return () => subscription.unsubscribe()
    }, [queryClient])

    const signIn = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            return { error: error as Error | null, profile: null }
        }

        // Fetch the profile immediately so we can return it for redirect decisions
        let userProfile: UserProfile | null = null
        if (data.user) {
            userProfile = await fetchProfile(data.user.id)
            // Also update the local state
            setProfile(userProfile)
        }

        return { error: null, profile: userProfile }
    }

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password })
        return { error: error as Error | null }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setSession(null)
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
