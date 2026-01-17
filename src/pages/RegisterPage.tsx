import { Link } from "react-router-dom"
import { RegisterForm } from "@/components/forms/RegisterForm"

export default function RegisterPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-4">
                        <img src="/images/educoach-logo.png" alt="EDUCOACH Logo" className="w-16 h-16" />
                    </div>
                    <h1 className="text-4xl font-bold text-balance mb-2">
                        Join <span className="text-primary">EDUCOACH</span>
                    </h1>
                    <p className="text-muted-foreground text-pretty">Start your personalized learning journey today</p>
                </div>

                <RegisterForm />

                <p className="text-center text-sm text-muted-foreground mt-6">
                    Already have an account?{" "}
                    <Link to="/login" className="text-primary hover:underline font-medium">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    )
}
