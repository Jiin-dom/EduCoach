import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, Brain, Clock, TrendingUp, Eye, Trash2, Sparkles, Loader2, RefreshCw, Zap } from "lucide-react"
import { FileUploadDialog } from "@/components/files/FileUploadDialog"
import { GenerateQuizDialog } from "@/components/files/GenerateQuizDialog"
import { QuizCard } from "@/components/dashboard/QuizCard"
import { TodaysStudyPlan } from "@/components/dashboard/TodaysStudyPlan"
import { WeakTopicsPanel } from "@/components/dashboard/WeakTopicsPanel"
import { MotivationalCard } from "@/components/dashboard/MotivationalCard"
import { ProgressInsightsSection } from "@/components/dashboard/ProgressInsightsSection"
import { AiTutorChat } from "@/components/shared/AiTutorChat"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useDocuments, useDeleteDocument, useProcessDocument, type Document } from "@/hooks/useDocuments"
import { formatFileSize } from "@/lib/storage"
import { Badge } from "@/components/ui/badge"
import { useQuizzes, useUserAttempts } from "@/hooks/useQuizzes"
import { useLearningStats, useStudyTimeLastTwoWeeks } from "@/hooks/useLearning"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMarkTrialWelcomeSeen } from "@/hooks/useStudentSubscription"

export function DashboardContent() {
    const { profile, user } = useAuth()
    const navigate = useNavigate()
    const [showUploadDialog, setShowUploadDialog] = useState(false)
    const [showTrialModal, setShowTrialModal] = useState(false)
    const [quizDialogOpen, setQuizDialogOpen] = useState(false)
    const [selectedDocForQuiz, setSelectedDocForQuiz] = useState<Document | null>(null)
    const markTrialWelcomeSeen = useMarkTrialWelcomeSeen()

    // Use real document data
    const { data: documents, isLoading, refetch } = useDocuments()
    const deleteDocument = useDeleteDocument()
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

    const handleDeleteFile = (doc: Document) => {
        if (window.confirm(`Delete "${doc.title}"?`)) {
            deleteDocument.mutate(doc)
        }
    }

    const handleRetryProcessing = (doc: Document) => {
        processDocument.mutate(doc.id)
    }

    const handleGenerateQuiz = (doc: Document) => {
        setSelectedDocForQuiz(doc)
        setQuizDialogOpen(true)
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

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return "Good morning"
        if (hour < 18) return "Good afternoon"
        return "Good evening"
    }

    const displayName = profile?.display_name || "Student"
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

    const handleCloseTrialModal = () => {
        if (isTrialActive && !hasSeenTrialWelcome && !markTrialWelcomeSeen.isPending) {
            markTrialWelcomeSeen.mutate()
        }
        setShowTrialModal(false)
    }

    return (
        <div className="space-y-8">
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

            {/* Welcome Section */}
            {/* <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-8 text-primary-foreground">
                <h1 className="text-3xl font-bold mb-2">{getGreeting()}, {displayName}!</h1>
                <p className="text-primary-foreground/90 text-lg">Ready to continue your learning journey?</p>
            </div> */}

            {isTrialActive && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
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

            {hasTrialEndedOnFree && (
                <Card className="border-amber-300 bg-amber-50">
                    <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-start gap-2">
                            <Clock className="w-5 h-5 text-amber-700 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-800">Your Premium Trial Has Ended</p>
                                <p className="text-sm text-amber-700">
                                    You’re now on Free limits. Upgrade to continue with unlimited EduBuddy and full analytics.
                                </p>
                            </div>
                        </div>
                        <Button size="sm" onClick={() => navigate("/subscription/checkout")}>
                            Upgrade To Premium
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Stats grid — gradient metric cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Study time this week */}
                <div className="group rounded-2xl border border-chart-1/20 bg-gradient-to-br from-chart-1/10 to-chart-1/5 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
                    <div className="flex flex-row items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                <Clock className="h-5 w-5" aria-hidden />
                            </div>
                            <p className="text-left text-xs font-medium leading-snug text-foreground/80">
                                Study time this week
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center justify-end text-right text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                            {studyTimeLoading ? (
                                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-label="Loading study time" />
                            ) : (
                                `${((studyTimeWeeks?.thisWeekMinutes ?? 0) / 60).toFixed(1)} hrs`
                            )}
                        </div>
                    </div>
                </div>

                {/* Quizzes completed */}
                <div className="group rounded-2xl border border-chart-2/20 bg-gradient-to-br from-chart-2/10 to-chart-2/5 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
                    <div className="flex flex-row items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2">
                                <Brain className="h-5 w-5" aria-hidden />
                            </div>
                            <p className="text-left text-xs font-medium leading-snug text-foreground/80">
                                Quizzes completed
                            </p>
                        </div>
                        <div className="shrink-0 text-right text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                            {learningStats?.quizzesCompleted ?? 0}
                        </div>
                    </div>
                </div>

                {/* Average score */}
                <div className="group rounded-2xl border border-chart-3/20 bg-gradient-to-br from-chart-3/10 to-chart-3/5 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
                    <div className="flex flex-row items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/15 text-chart-4">
                                <TrendingUp className="h-5 w-5" aria-hidden />
                            </div>
                            <p className="text-left text-xs font-medium leading-snug text-foreground/80">
                                Average score
                            </p>
                        </div>
                        <div className="shrink-0 text-right text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                            {learningStats?.averageScore ?? 0}%
                        </div>
                    </div>
                </div>

                {/* Day streak */}
                <div className="group rounded-2xl border border-orange-400/25 bg-gradient-to-br from-orange-400/10 to-orange-400/5 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
                    <div className="flex flex-row items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-400/15 text-orange-500 dark:text-orange-400">
                                <Zap className="h-5 w-5" aria-hidden />
                            </div>
                            <p className="text-left text-xs font-medium leading-snug text-foreground/80">
                                Day streak
                            </p>
                        </div>
                        <div className="shrink-0 text-right text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                            {learningStats?.studyStreak ?? 0}
                        </div>
                    </div>
                </div>
            </div>

            <TodaysStudyPlan />

            {/* Main Content Grid with Weak Topics Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Uploaded Files Section */}
                <Card className="lg:col-span-1 max-h-[620px] flex flex-col">
                    <CardHeader>
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
                                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs sm:px-3 sm:text-sm" asChild>
                                    <Link to="/files" onClick={(event) => event.stopPropagation()}>
                                        View all
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
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
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    {recentFiles.map((file) => (
                                        <div
                                            key={file.id}
                                            className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/5"
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
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{file.title}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{formatFileSize(file.file_size)}</span>
                                                    <Badge variant="outline" className={`text-xs ${getStatusColor(file.status)}`}>
                                                        {file.status}
                                                    </Badge>
                                                    {file.deadline && (
                                                        <span className="text-amber-600 dark:text-amber-500 font-medium">
                                                            Due {new Date(file.deadline).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Link
                                                    to={`/files/${file.id}`}
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                {file.status === 'error' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-orange-600 hover:text-orange-700"
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
                                                {/* {file.status === 'ready' && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-primary hover:text-primary"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        handleGenerateQuiz(file)
                                                                    }}
                                                                >
                                                                    <Sparkles className="w-4 h-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Generate quiz from this file</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        handleDeleteFile(file)
                                                    }}
                                                    disabled={deleteDocument.isPending}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button> */}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* <div className="flex gap-2">
                                    <Button onClick={(event) => {
                                        event.stopPropagation()
                                        setShowUploadDialog(true)
                                    }} variant="outline" className="flex-1">
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload More
                                    </Button>
                                    <Link to="/files" className="flex-1" onClick={(event) => event.stopPropagation()}>
                                        <Button variant="ghost" className="w-full">
                                            View All
                                        </Button>
                                    </Link>
                                </div> */}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quizzes Section */}
                <Card className="lg:col-span-1 max-h-[620px] flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Available Quizzes</CardTitle>
                           
                        </div>
                        <Link to="/quizzes">
                            <Button variant="outline" size="sm">
                                View All
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {recentQuizzes.length === 0 ? (
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
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="max-h-[620px]">
                    <WeakTopicsPanel />
                </div>
            </div>

            <ProgressInsightsSection hasPremiumEntitlement={hasPremiumEntitlement} />

            {/* <MotivationalCard /> */}

            <FileUploadDialog
                open={showUploadDialog}
                onOpenChange={setShowUploadDialog}
                onUploadComplete={handleUploadComplete}
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
