import { useState, useEffect } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { getOAuthCallbackError, getOAuthReturnPath, clearOAuthReturnPath } from "@/lib/oauthRedirect"
import { getPostLoginDestination } from "@/lib/authRouting"
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Eye, EyeOff, Loader2 } from "lucide-react"

export function LoginForm() {
    const navigate = useNavigate()
    const location = useLocation()
    const { signIn, user, profile, loading: authLoading } = useAuth()

    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(() => getOAuthCallbackError())
    const [loading, setLoading] = useState(false)

    // Get the intended destination from state, or default to dashboard
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard"

    useEffect(() => {
        if (authLoading || !user || !profile) return

        const oauthPath = getOAuthReturnPath()
        const destination = getPostLoginDestination({
            role: profile.role,
            hasCompletedProfiling: profile.has_completed_profiling,
            fromPath: from,
            oauthReturnPath: oauthPath,
        })

        clearOAuthReturnPath()
        navigate(destination, { replace: true })
    }, [user, profile, authLoading, navigate, from])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const { error, profile: freshProfile } = await signIn(email, password)

            if (error) {
                setError(error.message)
                return
            }

            if (!freshProfile) {
                // Auth listener will complete redirect once profile is loaded.
                return
            }

            const destination = getPostLoginDestination({
                role: freshProfile.role,
                hasCompletedProfiling: freshProfile.has_completed_profiling,
                fromPath: from,
            })

            navigate(destination, { replace: true })
        } catch {
            setError("An unexpected error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[1.5rem] w-full max-w-[500px] mx-auto h-auto">
            <CardContent className="p-8 md:p-10">
                <div className="mb-8">
                    <h2 className="text-[28px] font-bold mb-2 tracking-tight text-foreground">Sign in</h2>
                    <p className="text-sm text-muted-foreground font-medium">
                        Use your email and password, or continue with social login.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="email" className="font-bold text-sm">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="Enter your email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            required
                            className="h-11 rounded-full px-4 border-muted-foreground/30 focus-visible:ring-primary/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password" className="font-bold text-sm">Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                required
                                className="h-11 rounded-full px-4 border-muted-foreground/30 focus-visible:ring-primary/50 pr-11"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 pb-2">
                        <Link to="/register" className="text-primary font-bold hover:underline">
                            I'm a new user
                        </Link>
                        <Link to="/forgot-password" className="text-primary font-bold hover:underline">
                            Forgot Password?
                        </Link>
                    </div>

                    <Button type="submit" className="w-full h-11 rounded-full text-[15px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Logging in...
                            </>
                        ) : (
                            "Log in"
                        )}
                    </Button>
                </form>

                <div className="relative mt-8 mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-muted" />
                    </div>
                    <div className="relative flex justify-center text-[11px] uppercase">
                        <span className="bg-card px-3 text-muted-foreground font-medium">
                            Or continue with
                        </span>
                    </div>
                </div>

                <SocialAuthButtons returnTo={from} textPrefix="Continue with" />
            </CardContent>
        </Card>
    )
}
