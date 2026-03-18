import { RegisterForm } from "@/components/forms/RegisterForm"
import { CheckCircle2 } from "lucide-react"

export default function RegisterPage() {
    return (
        <div className="min-h-[100dvh] w-full flex bg-background">
            {/* Left Side - Hidden on mobile, visible on lg */}
            <div className="hidden lg:flex flex-1 flex-col justify-between p-12 xl:p-20 bg-gradient-to-br from-background via-primary/5 to-accent/10">
                <div>
                    <div className="flex items-center gap-3 mb-24">
                        <img src="/images/educoach-logo.png" alt="EDUCOACH Logo" className="w-12 h-12" />
                        <div>
                            <h2 className="font-bold text-lg leading-tight text-foreground tracking-tight">EDUCOACH</h2>
                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Study • Learn • Achieve</p>
                        </div>
                    </div>

                    <h1 className="text-5xl xl:text-[64px] font-extrabold leading-[1.1] mb-6 text-foreground tracking-[-0.02em]">
                        Create your account. <br/><span className="text-primary">Start your learning journey today.</span>
                    </h1>

                    <p className="text-muted-foreground mb-12 text-lg xl:text-xl text-balance font-medium max-w-lg">
                        Track progress, generate quizzes, and build study habits — all in one clean place.
                    </p>

                    <ul className="space-y-5">
                        <li className="flex items-center gap-4 text-base font-semibold">
                            <CheckCircle2 className="text-emerald-500 w-6 h-6 flex-shrink-0" />
                            Create specialized learning paths
                        </li>
                        <li className="flex items-center gap-4 text-base font-semibold">
                            <CheckCircle2 className="text-emerald-500 w-6 h-6 flex-shrink-0" />
                            Get reminders to study and revise
                        </li>
                        <li className="flex items-center gap-4 text-base font-semibold">
                            <CheckCircle2 className="text-emerald-500 w-6 h-6 flex-shrink-0" />
                            Level up with XP as you master topics
                        </li>
                    </ul>
                </div>

                <div className="text-[13px] font-medium text-muted-foreground flex items-center gap-2">
                    <span className="text-foreground">💡 Tip:</span> Use a strong password (12+ chars) for better security.
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-[500px] xl:w-[600px] 2xl:w-[700px] flex items-center justify-center p-4 py-8 relative bg-background border-l border-border/10">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent lg:hidden pointer-events-none" />
                <div className="w-full max-w-[500px] relative z-10">
                    {/* Only show logo on mobile */}
                    <div className="text-center mb-8 lg:hidden">
                        <div className="inline-flex items-center justify-center mb-5 bg-background p-3 rounded-2xl shadow-sm border border-border/50">
                            <img src="/images/educoach-logo.png" alt="EDUCOACH Logo" className="w-14 h-14" />
                        </div>
                        <h1 className="text-[28px] font-extrabold text-balance mb-2 tracking-tight">
                            Join <span className="text-primary">EDUCOACH</span>
                        </h1>
                    </div>

                    <RegisterForm />
                </div>
            </div>
        </div>
    )
}
