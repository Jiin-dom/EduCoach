import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, Brain, Clock, TrendingUp, Eye, Sparkles, Loader2, RefreshCw, Zap } from "lucide-react"
import { FileUploadDialog } from "@/components/files/FileUploadDialog"
import { GenerateQuizDialog } from "@/components/files/GenerateQuizDialog"
import { QuizCard } from "@/components/dashboard/QuizCard"
import { TodaysStudyPlan } from "@/components/dashboard/TodaysStudyPlan"
import { DashboardMiniCalendar } from "@/components/dashboard/DashboardMiniCalendar"
import { WeakTopicsPanel } from "@/components/dashboard/WeakTopicsPanel"

import { ProgressInsightsSection } from "@/components/dashboard/ProgressInsightsSection"
import { AiTutorChat } from "@/components/shared/AiTutorChat"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useDocuments, useProcessDocument, type Document } from "@/hooks/useDocuments"
import { formatFileSize } from "@/lib/storage"
import { Badge } from "@/components/ui/badge"
import { useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { useLearningStats, useStudyTimeLastTwoWeeks } from "@/hooks/useLearning"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { useMarkTrialWelcomeSeen } from "@/hooks/useStudentSubscription"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardContent() {
    const { profile, user } = useAuth()
    const navigate = useNavigate()
    const [showUploadDialog, setShowUploadDialog] = useState(false)
    const [showTrialModal, setShowTrialModal] = useState(false)
    const [showExpiredTrialModal, setShowExpiredTrialModal] = useState(false)
    const [quizDialogOpen, setQuizDialogOpen] = useState(false)
    const [selectedDocForQuiz, setSelectedDocForQuiz] = useState<Document | null>(null)
    const markTrialWelcomeSeen = useMarkTrialWelcomeSeen()

    // Use real document data
    const { data: documents, isLoading, refetch } = useDocuments()
    const processDocument = useProcessDocument()

    // Use real quiz data
    const { data: quizzes } = useQuizzes()
    const { data: attempts } = useUserAttempts()
    const { data: learningStats } = useLearningStats()
    const { data: studyTimeWeeks, isLoading: studyTimeLoading } = useStudyTimeLastTwoWeeks()

    const recentQuizzes = useMemo(() => {
        return (quizzes || []).filter((q) => q.status === 'ready' || q.status === 'generating').slice(0, 3)
    }, [quizzes])

    const lastScoreByQuiz = useMemo(() => {
        const map = new Map<string, number>()
        if (!attempts) return map
        for (const a of attempts) {
            if (a.completed_at && a.score !== null && !map.has(a.quiz_id)) {
                map.set(a.quiz_id, a.score)
            }
        }
        return map
    }, [attempts])

    // Get recent files (last 5)
    const recentFiles = documents?.slice(0, 5) || []

    const handleUploadComplete = () => {
        refetch()
    }

    const handleRetryProcessing = (doc: Document) => {
        processDocument.mutate(doc.id)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ready': return 'text-green-600 bg-green-50'
            case 'processing': return 'text-blue-600 bg-blue-50'
            case 'pending': return 'text-orange-600 bg-orange-50'
            case 'error': return 'text-red-600 bg-red-50'
            default: return 'text-gray-600 bg-gray-50'
        }
    }

    const isTrialActive = profile?.subscription_is_trial_active === true
    const trialDaysLeft = profile?.subscription_trial_days_left ?? 0
    const trialEndsAt = profile?.subscription_trial_ends_at
    const trialWelcomeSeenAt = profile?.subscription_trial_welcome_seen_at
    const hasPremiumEntitlement = profile?.has_premium_entitlement === true
    const hasSeenTrialWelcome = trialWelcomeSeenAt !== null
    const hasTrialEndedOnFree =
        !isTrialActive &&
        !hasPremiumEntitlement &&
        profile?.subscription_plan === "free" &&
        profile?.subscription_trial_ends_at !== null
    const trialEndLabel = trialEndsAt
        ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(trialEndsAt))
        : "your trial end date"
    const expiredTrialNoticeStorageKey = useMemo(
        () => (user?.id && trialEndsAt ? `educoach:trial-expired-notice:${user.id}:${trialEndsAt}` : null),
        [trialEndsAt, user?.id],
    )
    const trialFeatures = [
        {
            title: "Unlimited EduBuddy",
            description: "Instant, nuanced explanations for complex topics 24/7.",
            icon: Brain,
        },
        {
            title: "Full Analytics Access",
            description: "Deep-dive insights into your learning velocity and gaps.",
            icon: TrendingUp,
        },
        {
            title: "Priority Quiz Generation",
            description: "Instant adaptive assessments created from any study material.",
            icon: Sparkles,
        },
    ] as const

    useEffect(() => {
        if (!user?.id || !isTrialActive || hasSeenTrialWelcome) {
            setShowTrialModal(false)
            return
        }
        setShowTrialModal(true)
    }, [hasSeenTrialWelcome, isTrialActive, user?.id])

    useEffect(() => {
        if (!hasTrialEndedOnFree || !expiredTrialNoticeStorageKey) {
            setShowExpiredTrialModal(false)
            return
        }

        try {
            const hasSeenExpiredTrialNotice = window.localStorage.getItem(expiredTrialNoticeStorageKey)
            if (hasSeenExpiredTrialNotice) {
                setShowExpiredTrialModal(false)
                return
            }

            setShowExpiredTrialModal(true)
            window.localStorage.setItem(expiredTrialNoticeStorageKey, new Date().toISOString())
        } catch (error) {
            console.warn("[DashboardContent] Failed to persist expired trial notice state", error)
            setShowExpiredTrialModal(true)
        }
    }, [expiredTrialNoticeStorageKey, hasTrialEndedOnFree])

    const handleCloseTrialModal = () => {
        if (isTrialActive && !hasSeenTrialWelcome && !markTrialWelcomeSeen.isPending) {
            markTrialWelcomeSeen.mutate()
        }
        setShowTrialModal(false)
    }

    const handleCloseExpiredTrialModal = () => {
        setShowExpiredTrialModal(false)
    }

    return (
        <div className="h-full min-h-0 flex flex-col gap-8 overflow-y-auto lg:overflow-hidden">
            <Dialog open={showExpiredTrialModal} onOpenChange={(open) => !open && handleCloseExpiredTrialModal()}>
                <DialogContent showCloseButton={false} className="max-w-xl overflow-hidden border border-primary/10 bg-white p-0 shadow-[0_30px_75px_-26px_rgba(55,39,77,0.4)]">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Free trial expired</DialogTitle>
                        <DialogDescription>
                            Your premium trial ended on {trialEndLabel}. Upgrade to premium to keep using advanced study tools,
                            premium analytics, and priority generation.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative">
                        <div className="h-7 bg-gradient-to-r from-[#fce7f3] via-[#f3e8ff] to-[#e9d5ff]" />
                        <div className="pointer-events-none absolute -left-16 top-8 h-44 w-44 rounded-full bg-[#f3d7ff]/60 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-[#e4d0ff]/70 blur-3xl" />

                        <div className="relative px-7 pb-7 pt-6 sm:px-8">
                            <div className="inline-flex items-center rounded-full bg-[#fce7f3] px-3 py-1">
                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9d174d]">
                                    Trial Ended
                                </span>
                            </div>

                            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#37274d]">
                                Free trial expired
                            </h2>
                            <p className="mt-3 text-base leading-7 text-[#66547d]">
                                Your premium trial ended on {trialEndLabel}. Upgrade to premium to keep using advanced
                                study tools, premium analytics, and priority generation.
                            </p>

                            <div className="mt-6 rounded-2xl border border-primary/10 bg-[#f8f5ff] p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[#4e27a6]">
                                    <Clock className="h-4 w-4" />
                                    <span>What happens now</span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-[#66547d]">
                                    Your study materials stay in your library. Premium-only tools are now locked until you upgrade.
                                </p>
                            </div>

                            <div className="mt-6 space-y-3">
                                <Button
                                    className="h-12 w-full rounded-xl bg-[#643ad5] text-base font-semibold text-[#f7f0ff] hover:bg-[#582ac9]"
                                    onClick={() => {
                                        handleCloseExpiredTrialModal()
                                        navigate("/subscription")
                                    }}
                                >
                                    Upgrade to premium
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="h-10 w-full rounded-xl text-sm font-semibold text-[#66547d] hover:bg-transparent hover:text-[#37274d]"
                                    onClick={handleCloseExpiredTrialModal}
                                >
                                    Got it
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showTrialModal} onOpenChange={(open) => !open && handleCloseTrialModal()}>
                <DialogContent showCloseButton={false} className="max-w-5xl border-0 bg-transparent p-0 shadow-none sm:max-w-5xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>You’re On A 14-Day Premium Trial</DialogTitle>
                        <DialogDescription>
                            Welcome to EduCoach. Your account now has premium access for {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_30px_75px_-26px_rgba(55,39,77,0.4)]">
                        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[#a98fff]/40 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-[#e1c7ff]/55 blur-3xl" />

                        <div className="relative flex flex-col md:flex-row">
                            <div className="relative hidden w-5/12 overflow-hidden bg-[#f8edff] md:block">
                                <img
                                    className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-multiply"
                                    alt="Premium study setup"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAbzivyFu2h_lfUHmtRWelzT9a6iM8s5sf9ZhLlFnqEuKe-e0127t5VMcIehmWgXg0Saa8lQahVBPXAE1kRQc2j30PleoXyO2S_l7XK06wubd55duBghaAPzgcinBEcLk4NMlOkMiJ9M8eMvMxa29o9AKS65cobfmwOvG5lZZ9-YWH1Dus8kSs07iJxfCzmKlAIG2MeaRCiE0AJUflpHuYlTxEEGut_XNfNXVSYdbE1MolNiDo2UYDDCcqmALWGdI7xKIU6iEmCuFFK"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#643ad5]/45 to-transparent" />
                                <div className="absolute bottom-8 left-8 right-8 text-[#f7f0ff]">
                                    <p className="text-2xl font-extrabold leading-tight">Elevating Every Study Session.</p>
                                    <div className="mt-4 h-1 w-12 rounded-full bg-[#a98fff]" />
                                </div>
                            </div>

                            <div className="flex-1 p-8 md:p-11">
                                <div className="inline-flex items-center rounded-full bg-[#ff8db6] px-3 py-1">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#70103e]">
                                        Premium Atelier
                                    </span>
                                </div>

                                <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-[#37274d] md:text-4xl">
                                    Your 14-Day Academic Upgrade is Here
                                </h2>
                                <p className="mt-3 text-base font-medium text-[#66547d] md:text-lg">
                                    Welcome to a refined learning environment tailored for excellence. You still have{" "}
                                    {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} of premium access.
                                </p>

                                <div className="mt-7 space-y-5">
                                    {trialFeatures.map((feature) => {
                                        const FeatureIcon = feature.icon
                                        return (
                                            <div key={feature.title} className="flex items-start gap-4">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eedcff]">
                                                    <FeatureIcon className="h-5 w-5 text-[#643ad5]" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-[#37274d]">{feature.title}</p>
                                                    <p className="text-sm text-[#66547d]">{feature.description}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="mt-8 rounded-xl bg-[#f8edff] p-4">
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                        <div className="flex items-center gap-2 text-[#66547d]">
                                            <Clock className="h-4 w-4" />
                                            <span>Trial ends on</span>
                                        </div>
                                        <span className="font-bold text-[#643ad5]">{trialEndLabel}</span>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-3">
                                    <Button
                                        className="h-12 w-full rounded-xl bg-[#643ad5] text-base font-semibold text-[#f7f0ff] hover:bg-[#582ac9]"
                                        onClick={() => {
                                            handleCloseTrialModal()
                                            navigate("/subscription")
                                        }}
                                    >
                                        Explore Premium Features
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-10 w-full rounded-xl text-sm font-semibold text-[#66547d] hover:bg-transparent hover:text-[#37274d]"
                                        onClick={handleCloseTrialModal}
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>



            {isTrialActive && (
                <Card variant="dashboard" className="border-primary/30 bg-primary/5">
                    <CardContent density="compact" className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-start gap-2">
                            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                            <div>
                                <p className="font-semibold text-primary">Premium Trial Active</p>
                                <p className="text-sm text-muted-foreground">
                                    You have {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left in your 14-day free Premium trial.
                                </p>
                            </div>
                        </div>
                        <Button size="sm" onClick={() => navigate("/subscription")}>
                            Manage Subscription
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                <div className="space-y-6 min-h-0 lg:h-full lg:overflow-y-auto lg:pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {/* Stats grid — gradient metric cards */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* Study time this week */}
                        <div className="group rounded-2xl border border-chart-1/20 bg-gradient-to-br from-chart-1/10 via-card to-chart-1/5 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                                        <Clock className="h-5 w-5" aria-hidden />
                                    </div>
                                    <p className="text-left text-xs font-medium leading-snug text-foreground/75">
                                        Study time this week
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex items-end justify-between">
                                <div className="text-[11px] text-muted-foreground">This week</div>
                                <div className="flex shrink-0 items-center justify-end text-right text-3xl font-bold tabular-nums text-foreground">
                                    {studyTimeLoading ? (
                                        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-label="Loading study time" />
                                    ) : (
                                        `${((studyTimeWeeks?.thisWeekMinutes ?? 0) / 60).toFixed(1)} hrs`
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quizzes completed */}
                        <div className="group rounded-2xl border border-chart-2/20 bg-gradient-to-br from-chart-2/10 via-card to-chart-2/5 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chart-2/15 text-chart-2">
                                        <Brain className="h-5 w-5" aria-hidden />
                                    </div>
                                    <p className="text-left text-xs font-medium leading-snug text-foreground/75">
                                        Quizzes completed
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex items-end justify-between">
                                <div className="text-[11px] text-muted-foreground">All time</div>
                                <div className="shrink-0 text-right text-3xl font-bold tabular-nums text-foreground">
                                    {learningStats?.quizzesCompleted ?? 0}
                                </div>
                            </div>
                        </div>

                        {/* Average score */}
                        <div className="group rounded-2xl border border-chart-3/20 bg-gradient-to-br from-chart-3/10 via-card to-chart-3/5 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chart-4/15 text-chart-4">
                                        <TrendingUp className="h-5 w-5" aria-hidden />
                                    </div>
                                    <p className="text-left text-xs font-medium leading-snug text-foreground/75">
                                        Average score
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex items-end justify-between">
                                <div className="text-[11px] text-muted-foreground">Latest trend</div>
                                <div className="shrink-0 text-right text-3xl font-bold tabular-nums text-foreground">
                                    {learningStats?.averageScore ?? 0}%
                                </div>
                            </div>
                        </div>

                        {/* Day streak */}
                        <div className="group rounded-2xl border border-orange-400/25 bg-gradient-to-br from-orange-400/10 via-card to-orange-400/5 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-400/15 text-orange-500 dark:text-orange-400">
                                        <Zap className="h-5 w-5" aria-hidden />
                                    </div>
                                    <p className="text-left text-xs font-medium leading-snug text-foreground/75">
                                        Day streak
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex items-end justify-between">
                                <div className="text-[11px] text-muted-foreground">Consecutive days</div>
                                <div className="shrink-0 text-right text-3xl font-bold tabular-nums text-foreground">
                                    {learningStats?.studyStreak ?? 0}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Grid with Weak Topics Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Uploaded Files Section */}
                        <Card variant="dashboard" className="lg:col-span-1 h-[500px] flex flex-col">
                            <CardHeader density="compact">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <CardTitle>Study Materials</CardTitle>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                setShowUploadDialog(true)
                                            }}
                                            title="Upload file"
                                        >
                                            <Upload className="h-4 w-4" />
                                            <span className="sr-only">Upload file</span>
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent density="compact" className="flex-1 overflow-y-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                {isLoading ? (
                                    <div className="space-y-2.5">
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <div key={idx} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/40 p-3">
                                                <Skeleton className="h-9 w-9 rounded-md" />
                                                <div className="min-w-0 flex-1 space-y-2">
                                                    <Skeleton className="h-3.5 w-2/3" />
                                                    <Skeleton className="h-3 w-1/3" />
                                                </div>
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                            </div>
                                        ))}
                                    </div>
                                ) : recentFiles.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <Upload className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <h3 className="font-semibold mb-2">No files uploaded yet</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Upload your study materials to generate personalized quizzes
                                        </p>
                                        <Button onClick={(event) => {
                                            event.stopPropagation()
                                            setShowUploadDialog(true)
                                        }}>
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload File
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="space-y-2.5">
                                            {recentFiles.map((file) => (
                                                <div
                                                    key={file.id}
                                                    className={`group relative isolate flex items-center gap-3 overflow-hidden rounded-xl border bg-card/50 p-3 transition-all hover:border-primary/20 hover:bg-accent/5 ${file.status === "ready"
                                                        ? "border-emerald-300/80 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.35)]"
                                                        : file.status === "processing"
                                                            ? "border-sky-300/80 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)]"
                                                            : file.status === "pending"
                                                                ? "border-transparent"
                                                                : "border-border/70"
                                                        }`}
                                                    role="link"
                                                    tabIndex={0}
                                                    onClick={() => navigate(`/files/${file.id}`)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter" || event.key === " ") {
                                                            event.preventDefault()
                                                            navigate(`/files/${file.id}`)
                                                        }
                                                    }}
                                                >
                                                    {file.status === "pending" && (
                                                        <>
                                                            <span className="pointer-events-none absolute inset-0 rounded-xl bg-[conic-gradient(from_0deg,_rgba(139,92,246,0.15),_rgba(56,189,248,0.55),_rgba(167,139,250,0.25),_rgba(99,102,241,0.55),_rgba(139,92,246,0.15))] animate-[spin_2.8s_linear_infinite]" />
                                                            <span className="pointer-events-none absolute inset-[1px] rounded-[11px] bg-card/95" />
                                                        </>
                                                    )}
                                                    {file.status === "ready" && (
                                                        <span className="absolute right-2 top-2 z-10 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 shadow-sm">
                                                            Ready
                                                        </span>
                                                    )}
                                                    {file.status === "processing" && (
                                                        <span className="absolute right-2 top-2 z-10 rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 shadow-sm">
                                                            Processing
                                                        </span>
                                                    )}
                                                    {file.status === "pending" && (
                                                        <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 shadow-sm">
                                                            <Sparkles className="h-3 w-3 animate-pulse" />
                                                            EduBuddy Extracting
                                                        </span>
                                                    )}
                                                    <div className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-md ${file.status === "processing"
                                                        ? "bg-sky-100 text-sky-700"
                                                        : file.status === "pending"
                                                            ? "bg-violet-100 text-violet-700"
                                                            : "bg-primary/10 text-primary"
                                                        }`}>
                                                        {file.status === "processing" ? (
                                                            <Loader2 className="h-4.5 w-4.5 animate-spin" />
                                                        ) : file.status === "pending" ? (
                                                            <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                                                        ) : (
                                                            <FileText className="h-4.5 w-4.5" />
                                                        )}
                                                    </div>
                                                    <div className={`relative z-10 min-w-0 flex-1 ${(file.status === "ready" || file.status === "processing" || file.status === "pending") ? "pr-24" : ""}`}>
                                                        <p className="truncate text-sm font-semibold">{file.title}</p>
                                                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{formatFileSize(file.file_size)}</span>
                                                            {file.status !== "ready" && file.status !== "processing" && file.status !== "pending" && (
                                                                <Badge variant="outline" className={`border-0 text-[11px] ${getStatusColor(file.status)}`}>
                                                                    {file.status}
                                                                </Badge>
                                                            )}
                                                            {file.deadline && (
                                                                <span className="font-medium text-amber-600 dark:text-amber-500">
                                                                    Due {new Date(file.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={`relative z-10 flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100 ${(file.status === "ready" || file.status === "processing" || file.status === "pending") ? "mt-5" : ""}`}>
                                                        <Link
                                                            to={`/files/${file.id}`}
                                                            onClick={(event) => event.stopPropagation()}
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-md"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                        </Link>
                                                        {file.status === 'error' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-md text-orange-600 hover:text-orange-700"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    handleRetryProcessing(file)
                                                                }}
                                                                disabled={processDocument.isPending}
                                                                title="Retry processing (wait a few minutes if rate limited)"
                                                            >
                                                                <RefreshCw className={`w-4 h-4 ${processDocument.isPending ? 'animate-spin' : ''}`} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            {documents && documents.length > 0 && (
                                <CardFooter density="compact" className="pt-0 shrink-0">
                                    <Link to="/files" className="w-full" onClick={(event) => event.stopPropagation()}>
                                        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-primary">
                                            <FileText className="w-3.5 h-3.5 mr-2" />
                                            View all study materials
                                        </Button>
                                    </Link>
                                </CardFooter>
                            )}
                        </Card>

                        {/* Quizzes Section */}
                        <Card variant="dashboard" className="lg:col-span-1 h-[500px] flex flex-col">
                            <CardHeader density="compact" className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Available Quizzes</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent density="compact" className="flex-1 overflow-y-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                {!quizzes ? (
                                    <div className="space-y-3">
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <div key={idx} className="rounded-xl border bg-card p-3.5">
                                                <div className="flex items-start gap-3">
                                                    <Skeleton className="h-10 w-10 rounded-lg" />
                                                    <div className="flex-1 space-y-2">
                                                        <Skeleton className="h-4 w-2/3" />
                                                        <Skeleton className="h-3 w-1/2" />
                                                    </div>
                                                </div>
                                                <Skeleton className="mt-3 h-8 w-full rounded-md" />
                                            </div>
                                        ))}
                                    </div>
                                ) : recentQuizzes.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                        <p className="text-sm text-muted-foreground">
                                            No quizzes yet. Generate one from your study materials!
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentQuizzes.map((quiz) => (
                                            <QuizCard
                                                key={quiz.id}
                                                quiz={quiz}
                                                lastScore={lastScoreByQuiz.get(quiz.id) ?? null}
                                                compact
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                            {quizzes && quizzes.length > 0 && (
                                <CardFooter density="compact" className="pt-0 shrink-0">
                                    <Link to="/quizzes" className="w-full">
                                        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-primary">
                                            <Brain className="w-3.5 h-3.5 mr-2" />
                                            View all available quizzes
                                        </Button>
                                    </Link>
                                </CardFooter>
                            )}
                        </Card>

                        <div className="h-[500px]">
                            <WeakTopicsPanel />
                        </div>
                    </div>

                    <ProgressInsightsSection hasPremiumEntitlement={hasPremiumEntitlement} />
                </div>

                <div className="min-h-0 lg:h-full lg:overflow-y-auto lg:pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex min-h-0 flex-col gap-4">
                        <DashboardMiniCalendar className="min-h-[220px] lg:flex-[0.9]" />
                        <TodaysStudyPlan className="min-h-0 lg:flex-[1.7]" />
                    </div>
                </div>
            </div>



            <FileUploadDialog
                open={showUploadDialog}
                onOpenChange={setShowUploadDialog}
                onUploadComplete={handleUploadComplete}
                documentCount={documents?.length ?? 0}
                hasPremiumEntitlement={hasPremiumEntitlement}
            />

            {selectedDocForQuiz && (
                <GenerateQuizDialog
                    open={quizDialogOpen}
                    onOpenChange={(open) => {
                        setQuizDialogOpen(open)
                        if (!open) {
                            setSelectedDocForQuiz(null)
                        }
                    }}
                    documentId={selectedDocForQuiz.id}
                />
            )}

            <AiTutorChat />
        </div>
    )
}
