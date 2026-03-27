import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { hasPremiumEntitlement } from '@/lib/subscription'

interface ProtectedRouteProps {
    children: React.ReactNode
    requireProfile?: boolean
    requireAdmin?: boolean
    requirePremium?: boolean
}

export function ProtectedRoute({
    children,
    requireProfile = false,
    requireAdmin = false,
    requirePremium = false,
}: ProtectedRouteProps) {
    const { user, profile, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        // Redirect to login, save intended destination
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (requireAdmin) {
        if (!profile) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-muted-foreground">Loading profile...</p>
                    </div>
                </div>
            )
        }

        if (profile.role !== 'admin') {
            return <Navigate to="/dashboard" replace />
        }
    }

    if (requireProfile && profile && !profile.has_completed_profiling) {
        // User needs to complete profiling first
        return <Navigate to="/profiling" replace />
    }

    if (requirePremium) {
        if (!profile) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-muted-foreground">Loading subscription...</p>
                    </div>
                </div>
            )
        }

        const hasPremiumAccess = hasPremiumEntitlement(
            profile.subscription_plan,
            profile.subscription_status,
            profile.subscription_trial_ends_at
        )
        if (!hasPremiumAccess) {
            return <Navigate to="/subscription" replace />
        }
    }

    return <>{children}</>
}
