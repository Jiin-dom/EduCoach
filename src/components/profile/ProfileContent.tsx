import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
    KeyRound,
    CheckCircle2,
    AlertCircle,
    Eye,
    EyeOff,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useLearningStats, useConceptMasteryList } from "@/hooks/useLearning"
import { useDocuments } from "@/hooks/useDocuments"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export function ProfileContent() {
    const { profile, user, signOut, updateProfile } = useAuth()
    const { data: stats, isLoading: statsLoading } = useLearningStats()
    const { data: masteryList } = useConceptMasteryList()
    const { data: documents } = useDocuments()

    const [darkMode, setDarkMode] = useState(false)
    const [notifications, setNotifications] = useState(true)

    // Change Password modal state
    const [changePasswordOpen, setChangePasswordOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [passwordSuccess, setPasswordSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    // Delete Account modal state
    const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [displayNameInput, setDisplayNameInput] = useState(profile?.display_name ?? "")
    const [isSavingProfile, setIsSavingProfile] = useState(false)

    const handleOpenChangePassword = () => {
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setPasswordError(null)
        setPasswordSuccess(false)
        setShowPassword(false)
        setChangePasswordOpen(true)
    }

    const handleChangePassword = async () => {
        setPasswordError(null)

        // --- Client-side validation ---
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError("All fields are required.")
            return
        }
        if (newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters.")
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("New password and confirm password do not match.")
            return
        }
        if (currentPassword === newPassword) {
            setPasswordError("New password must be different from your current password.")
            return
        }

        setPasswordLoading(true)
        try {
            // Step 1: Verify current password by re-authenticating
            const email = user?.email
            if (!email) {
                setPasswordError("Unable to verify your identity. Please log in again.")
                return
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            })

            if (signInError) {
                setPasswordError("Current password is incorrect.")
                return
            }

            // Step 2: Update to new password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            })

            if (updateError) {
                setPasswordError(updateError.message || "Failed to update password. Please try again.")
                return
            }

            // Success
            setPasswordSuccess(true)
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
        } catch {
            setPasswordError("An unexpected error occurred. Please try again.")
        } finally {
            setPasswordLoading(false)
        }
    }

    const handleDeleteAccount = async () => {
        setDeleteLoading(true)
        try {
            // First attempt to delete from the database using our custom RPC
            const { error } = await supabase.rpc('delete_user')
            if (error) {
                console.error('Failed to delete user account:', error)
                // If it fails, we shouldn't log them out or redirect
                // A production app might show a toast error here
                return
            }

            // Once deleted, log them out locally
            await signOut()
            
            // Redirect to home/landing page
            window.location.href = '/'
        } catch (e) {
            console.error('Unexpected error during account deletion:', e)
        } finally {
            setDeleteLoading(false)
            setDeleteAccountOpen(false)
        }
    }

    useEffect(() => {
        setDisplayNameInput(profile?.display_name ?? "")
    }, [profile?.display_name])

    const displayName = profile?.display_name || "Student"
    const email = user?.email || profile?.email || ""
    const normalizedCurrentDisplayName = (profile?.display_name ?? "").trim()
    const normalizedInputDisplayName = displayNameInput.trim()
    const hasDisplayNameChanged = normalizedInputDisplayName !== normalizedCurrentDisplayName
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

    const handleSaveProfile = async () => {
        if (!normalizedInputDisplayName) {
            toast.error("Display name cannot be empty.")
            return
        }

        if (!hasDisplayNameChanged) {
            return
        }

        setIsSavingProfile(true)
        try {
            const { error } = await updateProfile({ display_name: normalizedInputDisplayName })
            if (error) {
                toast.error(error.message || "Failed to update display name.")
                return
            }

            setDisplayNameInput(normalizedInputDisplayName)
            toast.success("Profile updated successfully.")
        } catch {
            toast.error("An unexpected error occurred while updating your profile.")
        } finally {
            setIsSavingProfile(false)
        }
    }

    return (
        <>
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
                                    <Input
                                        id="fullName"
                                        value={displayNameInput}
                                        onChange={(e) => setDisplayNameInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                                        disabled={isSavingProfile}
                                    />
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

                            <Button
                                className="mt-4"
                                onClick={handleSaveProfile}
                                disabled={isSavingProfile || !hasDisplayNameChanged}
                            >
                                {isSavingProfile ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
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
                                <Button
                                    variant="outline"
                                    className="w-full mb-2"
                                    onClick={handleOpenChangePassword}
                                >
                                    <KeyRound className="w-4 h-4 mr-2" />
                                    Change Password
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => setDeleteAccountOpen(true)}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Account
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        {/* Change Password Dialog */}
        <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="w-5 h-5" />
                        Change Password
                    </DialogTitle>
                    <DialogDescription>
                        Enter your current password, then choose a new one.
                    </DialogDescription>
                </DialogHeader>

                {passwordSuccess ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                        <p className="font-semibold text-lg">Password Updated!</p>
                        <p className="text-sm text-muted-foreground">
                            Your password has been changed successfully.
                        </p>
                        <Button className="mt-2" onClick={() => setChangePasswordOpen(false)}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <div className="relative">
                                    <Input
                                        id="currentPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your current password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        disabled={passwordLoading}
                                        autoComplete="current-password"
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={passwordLoading}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="At least 6 characters"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        disabled={passwordLoading}
                                        autoComplete="new-password"
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={passwordLoading}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Repeat your new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={passwordLoading}
                                        autoComplete="new-password"
                                        onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={passwordLoading}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            {passwordError && (
                                <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{passwordError}</span>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                variant="outline"
                                onClick={() => setChangePasswordOpen(false)}
                                disabled={passwordLoading}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleChangePassword} disabled={passwordLoading}>
                                {passwordLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    "Update Password"
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>

        {/* Delete Account Dialog */}
        <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <Trash2 className="w-5 h-5" />
                        Delete Account
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete your account? This action cannot be undone and will permanently erase all your data.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setDeleteAccountOpen(false)}
                        disabled={deleteLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading}
                    >
                        {deleteLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            "OK / Confirm"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}
