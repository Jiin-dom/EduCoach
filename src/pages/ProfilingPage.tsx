import { ProfilingForm } from "@/components/forms/ProfilingForm"

export default function ProfilingPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-4">
                        <img src="/images/educoach-logo.png" alt="EDUCOACH Logo" className="w-16 h-16" />
                    </div>
                    <h1 className="text-4xl font-bold text-balance mb-2">Let's personalize your learning</h1>
                    <p className="text-muted-foreground text-pretty">
                        Tell us about yourself so we can create the perfect study plan
                    </p>
                </div>

                <ProfilingForm />
            </div>
        </div>
    )
}
