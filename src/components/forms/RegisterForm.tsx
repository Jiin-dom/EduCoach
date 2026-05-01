import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { getPasswordRequirementChecks, validateEmail, validatePassword, validateName } from "@/lib/authValidation"
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Eye, EyeOff, Loader2, ChevronLeft, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function RegisterForm() {
    const navigate = useNavigate()
    const { signUp } = useAuth()

    const [showPassword, setShowPassword] = useState(false)
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
    })
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})
    const [loading, setLoading] = useState(false)
    const passwordRequirements = getPasswordRequirementChecks(formData.password)
    const showPasswordChecklistFeedback = formData.password.length > 0 || Boolean(fieldErrors.password)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const errors: Record<string, string | null> = {
            firstName: validateName(formData.firstName, "First name"),
            lastName: validateName(formData.lastName, "Last name"),
            email: validateEmail(formData.email),
        }
        const pwErrors = validatePassword(formData.password)
        if (pwErrors.length > 0) errors.password = pwErrors.join(", ")
        if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Passwords do not match"

        const hasErrors = Object.values(errors).some(Boolean)
        setFieldErrors(errors)
        if (hasErrors) return

        setLoading(true)

        try {
            const { error } = await signUp(formData.email, formData.password, formData.firstName.trim(), formData.lastName.trim())

            if (error) {
                setError(error.message)
                return
            }
            navigate("/profiling")
        } catch {
            setError("An unexpected error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-[500px] mx-auto flex flex-col gap-4">
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between px-2 text-sm font-bold pt-4 pb-2">
                <Link to="/login" className="flex items-center gap-1 hover:text-primary transition-colors text-foreground">
                    <ChevronLeft className="w-4 h-4" /> Back to Login
                </Link>
                <div className="text-muted-foreground hidden sm:block font-medium">
                    Already have an account? <Link to="/login" className="text-primary hover:underline font-bold">Sign in</Link>
                </div>
            </div>

            <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[1.5rem] w-full bg-card">
                <CardContent className="p-8 md:p-10">
                    <div className="mb-8">
                        <h2 className="text-[28px] font-bold mb-2 tracking-tight text-foreground">Create Account</h2>
                        <p className="text-sm text-muted-foreground font-medium">
                            Fill in your details to create a new account.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                                {error}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="firstName" className="font-bold text-sm">First Name</Label>
                                <Input
                                    id="firstName"
                                    type="text"
                                    placeholder="e.g. John"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    disabled={loading}
                                    required
                                    className="h-11 rounded-full px-4 border-muted-foreground/30 focus-visible:ring-primary/50"
                                />
                                {fieldErrors.firstName && <p className="text-xs text-destructive">{fieldErrors.firstName}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName" className="font-bold text-sm">Last Name</Label>
                                <Input
                                    id="lastName"
                                    type="text"
                                    placeholder="e.g. Doe"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    disabled={loading}
                                    required
                                    className="h-11 rounded-full px-4 border-muted-foreground/30 focus-visible:ring-primary/50"
                                />
                                {fieldErrors.lastName && <p className="text-xs text-destructive">{fieldErrors.lastName}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="font-bold text-sm">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter email address"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={loading}
                                required
                                className="h-11 rounded-full px-4 border-muted-foreground/30 focus-visible:ring-primary/50"
                            />
                            {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="font-bold text-sm">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    disabled={loading}
                                    required
                                    className={cn(
                                        "h-11 rounded-full px-4 border-muted-foreground/30 focus-visible:ring-primary/50 pr-11",
                                        fieldErrors.password && "border-destructive/60 focus-visible:ring-destructive/30",
                                    )}
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
                            <Label htmlFor="confirmPassword" className="font-bold text-sm">Confirm Password</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Confirm password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    disabled={loading}
                                    required
                                    className="h-11 rounded-full px-4 border-muted-foreground/30 focus-visible:ring-primary/50 pr-11"
                                />
                            </div>
                            {fieldErrors.confirmPassword && <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>}
                        </div>

                        <div className="text-center text-[11px] text-muted-foreground py-2 text-balance leading-relaxed font-medium">
                            By registering, you agree to our <Link to="#" className="text-primary font-bold hover:underline">Terms & Conditions</Link> and <Link to="#" className="text-primary font-bold hover:underline">Privacy Policy</Link>
                        </div>

                        <Button type="submit" className="w-full h-11 rounded-full text-[15px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                "Create Account"
                            )}
                        </Button>
                    </form>

                    <div className="block sm:hidden text-center text-sm font-medium mt-8 text-muted-foreground">
                        Already have an account? <Link to="/login" className="text-primary hover:underline font-bold">Sign in</Link>
                    </div>

                    <div className="relative mt-8 mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-muted" />
                        </div>
                        <div className="relative flex justify-center text-[11px] uppercase">
                            <span className="bg-card px-3 text-muted-foreground font-medium">
                                Or sign up with
                            </span>
                        </div>
                    </div>

                    <SocialAuthButtons textPrefix="Continue with" />
                </CardContent>
            </Card>
        </div>
    )
}
