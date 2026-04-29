interface BrandedLoaderProps {
    message?: string
    className?: string
    fullScreen?: boolean
    size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASS_MAP: Record<NonNullable<BrandedLoaderProps['size']>, string> = {
    sm: 'h-14 w-14',
    md: 'h-20 w-20',
    lg: 'h-24 w-24',
}

export function BrandedLoader({
    message = 'Loading...',
    className = '',
    fullScreen = false,
    size = 'md',
}: BrandedLoaderProps) {
    const shellClass = fullScreen
        ? 'min-h-screen flex items-center justify-center bg-background'
        : 'w-full flex items-center justify-center'

    return (
        <div className={`${shellClass} ${className}`}>
            <div className="relative flex flex-col items-center gap-4 rounded-2xl px-6 py-5">
                <div className="pointer-events-none absolute inset-x-8 top-7 h-12 rounded-full bg-primary/10 blur-xl" />

                <img
                    src="/educoach-logo-svg.svg"
                    alt="EduCoach"
                    className={`relative z-10 ${SIZE_CLASS_MAP[size]} edu-logo-float edu-logo-svg`}
                />

                <div className="relative z-10 flex items-center gap-1 text-sm font-medium text-muted-foreground">
                    <span>{message}</span>
                    <span className="inline-flex items-center">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-primary/55 [animation-delay:0ms]" />
                        <span className="ml-1 h-1 w-1 animate-pulse rounded-full bg-primary/55 [animation-delay:180ms]" />
                        <span className="ml-1 h-1 w-1 animate-pulse rounded-full bg-primary/55 [animation-delay:360ms]" />
                    </span>
                </div>
            </div>
        </div>
    )
}
