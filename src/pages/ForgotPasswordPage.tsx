import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { validateEmail } from "@/lib/authValidation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

export default function ForgotPasswordPage() {
    const navigate = useNavigate()
    const { checkEmailExists } = useAuth()
    const [email, setEmail] = useState("")
    const [emailError, setEmailError] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [exists, setExists] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(false)

    const handleCheckEmail = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setEmailError(null)
        setExists(null)

        const validationError = validateEmail(email)
        if (validationError) {
            setEmailError(validationError)
            return
        }

        setLoading(true)
        try {
            const { error: checkError, exists: emailExists } = await checkEmailExists(email)
            if (checkError) {
                setError(checkError.message)
                return
            }
            if (emailExists) {
                navigate(`/forgot-password/set?email=${encodeURIComponent(email.trim().toLowerCase())}`)
                return
            }
            setExists(false)
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
                        <Link to="/login" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline mb-5">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Login
                        </Link>
                        <h1 className="text-[28px] font-bold mb-2 tracking-tight text-foreground">Check your email</h1>
                        <p className="text-sm text-muted-foreground font-medium">
                            Enter your account email to verify whether it is registered.
                        </p>
                    </div>

                    <form onSubmit={handleCheckEmail} className="space-y-5">
                        {error && (
                            <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                                {error}
                            </div>
                        )}
                        {exists === false && (
                            <div className="p-3 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
                                This email is not registered yet. You can create a new account.
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
                            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 rounded-full text-[15px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Checking email...
                                </>
                            ) : (
                                "Check email"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
