import { Link } from "react-router-dom"
import { LoginForm } from "@/components/forms/LoginForm"

export default function LoginPage() {
    return (
        <div className="min-h-[100dvh] grid place-items-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4 py-8">
            <div className="w-full max-w-md mx-auto">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-4">
                        <img src="/images/educoach-logo.png" alt="EDUCOACH Logo" className="w-16 h-16" />
                    </div>
                    <h1 className="text-4xl font-bold text-balance mb-2">
                        Welcome to <span className="text-primary">EDUCOACH</span>
                    </h1>
                    <p className="text-muted-foreground text-pretty">
                        Your personalized study companion for performance-driven learning
                    </p>
                </div>

                <LoginForm />

                <p className="text-center text-sm text-muted-foreground mt-6">
                    Don't have an account?{" "}
                    <Link to="/register" className="text-primary hover:underline font-medium">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    )
}
