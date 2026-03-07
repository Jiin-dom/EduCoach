import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
    User,
    Calendar,
    Clock,
    Brain,
    TrendingUp,
    Shield,
    Bell,
    Moon,
    Trash2,
    Target,
    Award,
    Flame,
    Loader2,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useLearningStats, useConceptMasteryList } from "@/hooks/useLearning"
import { useDocuments } from "@/hooks/useDocuments"

export function ProfileContent() {
    const { profile, user } = useAuth()
    const { data: stats, isLoading: statsLoading } = useLearningStats()
    const { data: masteryList } = useConceptMasteryList()
    const { data: documents } = useDocuments()

    const [darkMode, setDarkMode] = useState(false)
    const [notifications, setNotifications] = useState(true)

    const displayName = profile?.display_name || "Student"
    const email = user?.email || profile?.email || ""
    const initials = displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    const joinDate = user?.created_at
        ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : '—'

    // Compute real learning insights
    const strongestSubject = (() => {
        if (!masteryList || masteryList.length === 0) return 'N/A'
        const byCategory = new Map<string, number[]>()
        for (const m of masteryList) {
            const cat = m.concept_category || 'General'
            const existing = byCategory.get(cat) || []
            existing.push(Number(m.mastery_score))
            byCategory.set(cat, existing)
        }
        let best = ''
        let bestAvg = -1
        for (const [cat, scores] of byCategory) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length
            if (avg > bestAvg) { bestAvg = avg; best = cat }
        }
        return best
    })()

    const weakestSubject = (() => {
        if (!masteryList || masteryList.length === 0) return 'N/A'
        const byCategory = new Map<string, number[]>()
        for (const m of masteryList) {
            const cat = m.concept_category || 'General'
            const existing = byCategory.get(cat) || []
            existing.push(Number(m.mastery_score))
            byCategory.set(cat, existing)
        }
        let worst = ''
        let worstAvg = 101
        for (const [cat, scores] of byCategory) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length
            if (avg < worstAvg) { worstAvg = avg; worst = cat }
        }
        return worst
    })()

    const learningInsights = [
        { label: "Best Subject", value: strongestSubject, icon: Brain },
        { label: "Needs Improvement", value: weakestSubject, icon: TrendingUp },
        { label: "Concepts Tracked", value: String(stats?.totalConcepts ?? 0), icon: Target },
        { label: "Readiness Score", value: `${stats?.averageMastery ?? 0}%`, icon: Award },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Profile Settings</h1>
                    <p className="text-muted-foreground">Manage your account and preferences</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Overview */}
                <Card className="lg:col-span-1">
                    <CardHeader className="text-center">
                        <Avatar className="w-24 h-24 mx-auto mb-4">
                            <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <CardTitle>{displayName}</CardTitle>
                        <CardDescription>{email}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {profile?.study_goal && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                                <Target className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Study Goal</p>
                                    <p className="font-medium">{profile.study_goal}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                            <Calendar className="w-5 h-5 text-primary" />
                            <div>
                                <p className="text-sm text-muted-foreground">Member Since</p>
                                <p className="font-medium">{joinDate}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                            <Clock className="w-5 h-5 text-primary" />
                            <div>
                                <p className="text-sm text-muted-foreground">Daily Target</p>
                                <p className="font-medium">{profile?.daily_study_minutes ?? 30} minutes</p>
                            </div>
                        </div>

                        {/* Quick Stats from real data */}
                        {statsLoading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <div className="text-center p-3 rounded-lg bg-primary/10">
                                    <div className="flex items-center justify-center gap-1 text-primary mb-1">
                                        <Flame className="w-4 h-4" />
                                        <span className="text-xl font-bold">{stats?.studyStreak ?? 0}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Day Streak</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-primary/10">
                                    <div className="text-xl font-bold text-primary mb-1">
                                        {stats?.quizzesCompleted ?? 0}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Quizzes</p>
                                </div>
                            </div>
                        )}

                        {/* Materials count */}
                        <div className="text-center text-sm text-muted-foreground">
                            {documents?.length ?? 0} study material{(documents?.length ?? 0) !== 1 ? 's' : ''} uploaded
                        </div>
                    </CardContent>
                </Card>

                {/* Main Settings */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Personal Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Personal Information
                            </CardTitle>
                            <CardDescription>Update your personal details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Display Name</Label>
                                    <Input id="fullName" defaultValue={displayName} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" defaultValue={email} disabled />
                                </div>
                            </div>

                            {profile?.preferred_subjects && profile.preferred_subjects.length > 0 && (
                                <div>
                                    <Label className="mb-2 block">Preferred Subjects</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.preferred_subjects.map((subject, index) => (
                                            <Badge key={index} variant="secondary" className="px-3 py-1">
                                                {subject}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button className="mt-4">Save Changes</Button>
                        </CardContent>
                    </Card>

                    {/* AI Learning Insights - real data */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Brain className="w-5 h-5" />
                                Learning Insights
                            </CardTitle>
                            <CardDescription>Based on your actual quiz and study performance</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {learningInsights.map((insight, index) => (
                                    <div key={index} className="p-4 rounded-lg border bg-card text-center">
                                        <insight.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                                        <p className="text-sm text-muted-foreground mb-1">{insight.label}</p>
                                        <p className="font-semibold">{insight.value}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Account Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                Account Settings
                            </CardTitle>
                            <CardDescription>Manage your account preferences</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Moon className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Dark Mode</p>
                                        <p className="text-sm text-muted-foreground">Toggle dark theme</p>
                                    </div>
                                </div>
                                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Bell className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Notifications</p>
                                        <p className="text-sm text-muted-foreground">Receive study reminders</p>
                                    </div>
                                </div>
                                <Switch checked={notifications} onCheckedChange={setNotifications} />
                            </div>

                            <div className="pt-4 border-t">
                                <Button variant="outline" className="w-full mb-2">
                                    Change Password
                                </Button>
                                <Button variant="destructive" className="w-full">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Account
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
