import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { getPasswordRequirementChecks, validatePassword } from "@/lib/authValidation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

export default function SetNewPasswordPage() {
    const navigate = useNavigate()
    const { resetPasswordByEmail } = useAuth()
    const [searchParams] = useSearchParams()
    const email = useMemo(() => searchParams.get("email")?.trim().toLowerCase() ?? "", [searchParams])

    const [showPassword, setShowPassword] = useState(false)
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const passwordRequirements = getPasswordRequirementChecks(newPassword)
    const showPasswordChecklistFeedback = newPassword.length > 0

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!email) {
            setError("Missing verified email. Please check your email again first.")
            return
        }

        if (!newPassword || !confirmPassword) {
            setError("Both password fields are required.")
            return
        }

        const passwordErrors = validatePassword(newPassword)
        if (passwordErrors.length > 0) {
            setError(passwordErrors.join(". ") + ".")
            return
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }

        setLoading(true)
        try {
            const { error: resetError } = await resetPasswordByEmail(email, newPassword)
            if (resetError) {
                setError(resetError.message)
                return
            }
            navigate("/login", {
                replace: true,
                state: { passwordResetSuccess: true },
            })
        } catch {
            setError("An unexpected error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4">
            <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[1.5rem] w-full max-w-[500px]">
                <CardContent className="p-8 md:p-10">
                    <div className="mb-8">
                        <Link to="/forgot-password" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline mb-5">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Email Check
                        </Link>
                        <h1 className="text-[28px] font-bold mb-2 tracking-tight text-foreground">Set new password</h1>
                        <p className="text-sm text-muted-foreground font-medium">
                            {email ? `Verified email: ${email}` : "Set a new password for your verified account."}
                        </p>
                    </div>

                    <form onSubmit={handleSetPassword} className="space-y-5">
                        {error && (
                            <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="newPassword" className="font-bold text-sm">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
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
                            <div className="rounded-2xl border border-border bg-muted/45 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Password must contain
                                </p>
                                <div className="mt-3 space-y-2">
                                    {passwordRequirements.map((requirement) => {
                                        const unmetClassName = showPasswordChecklistFeedback
                                            ? "text-destructive"
                                            : "text-muted-foreground"

                                        return (
                                            <div key={requirement.label} className="flex items-center gap-2.5 text-sm">
                                                {requirement.met ? (
                                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                                ) : (
                                                    <XCircle className={cn("h-4 w-4 shrink-0", unmetClassName)} />
                                                )}
                                                <span className={cn("font-medium", requirement.met ? "text-foreground" : unmetClassName)}>
                                                    {requirement.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="font-bold text-sm">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                placeholder="Confirm your new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                                required
                                className="h-11 rounded-full px-4 border-muted-foreground/30 focus-visible:ring-primary/50"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 rounded-full text-[15px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Updating password...
                                </>
                            ) : (
                                "Set new password"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
