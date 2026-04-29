import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { hasPremiumEntitlement } from '@/lib/subscription'
import { BrandedLoader } from '@/components/ui/branded-loader'

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
            <BrandedLoader fullScreen size="lg" message="Loading your workspace..." />
        )
    }

    if (!user) {
        // Redirect to login, save intended destination
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (requireAdmin) {
        if (!profile) {
            return (
                <BrandedLoader fullScreen size="lg" message="Loading profile..." />
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
                <BrandedLoader fullScreen size="lg" message="Loading subscription..." />
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
