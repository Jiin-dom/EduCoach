import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    User,
    Mail,
    GraduationCap,
    Calendar,
    Clock,
    Brain,
    TrendingUp,
    Shield,
    Bell,
    Moon,
    Trash2,
    BookOpen,
    Target,
    Award,
    Flame,
} from "lucide-react"

export function ProfileContent() {
    const [darkMode, setDarkMode] = useState(false)
    const [notifications, setNotifications] = useState(true)

    const userProfile = {
        name: "John Doe",
        email: "john.doe@university.edu",
        course: "Computer Science",
        yearLevel: "3rd Year",
        joinDate: "September 2023",
        studyTime: ["08:00 - 10:00", "14:00 - 16:00"],
        studyDays: ["Monday", "Wednesday", "Friday", "Saturday"],
    }

    const stats = {
        totalStudyHours: 156,
        quizzesCompleted: 48,
        averageScore: 87,
        streak: 5,
        materialsUploaded: 24,
    }

    const learningInsights = [
        { label: "Best Subject", value: "Computer Science", icon: Brain },
        { label: "Needs Improvement", value: "Physics", icon: TrendingUp },
        { label: "Study Consistency", value: "85%", icon: Target },
        { label: "Readiness Score", value: "78%", icon: Award },
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
                            <AvatarFallback className="text-3xl bg-primary text-primary-foreground">JD</AvatarFallback>
                        </Avatar>
                        <CardTitle>{userProfile.name}</CardTitle>
                        <CardDescription>{userProfile.email}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                            <GraduationCap className="w-5 h-5 text-primary" />
                            <div>
                                <p className="text-sm text-muted-foreground">Course</p>
                                <p className="font-medium">{userProfile.course}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                            <Calendar className="w-5 h-5 text-primary" />
                            <div>
                                <p className="text-sm text-muted-foreground">Year Level</p>
                                <p className="font-medium">{userProfile.yearLevel}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                            <Clock className="w-5 h-5 text-primary" />
                            <div>
                                <p className="text-sm text-muted-foreground">Member Since</p>
                                <p className="font-medium">{userProfile.joinDate}</p>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-3 pt-4">
                            <div className="text-center p-3 rounded-lg bg-primary/10">
                                <div className="flex items-center justify-center gap-1 text-primary mb-1">
                                    <Flame className="w-4 h-4" />
                                    <span className="text-xl font-bold">{stats.streak}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">Day Streak</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-primary/10">
                                <div className="text-xl font-bold text-primary mb-1">{stats.quizzesCompleted}</div>
                                <p className="text-xs text-muted-foreground">Quizzes</p>
                            </div>
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
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <Input id="fullName" defaultValue={userProfile.name} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" defaultValue={userProfile.email} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="course">Course / Major</Label>
                                    <Input id="course" defaultValue={userProfile.course} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="yearLevel">Year Level</Label>
                                    <Input id="yearLevel" defaultValue={userProfile.yearLevel} />
                                </div>
                            </div>
                            <Button className="mt-4">Save Changes</Button>
                        </CardContent>
                    </Card>

                    {/* Study Preferences */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5" />
                                Study Preferences
                            </CardTitle>
                            <CardDescription>Your preferred study schedule</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="mb-2 block">Preferred Study Times</Label>
                                <div className="flex flex-wrap gap-2">
                                    {userProfile.studyTime.map((time, index) => (
                                        <Badge key={index} variant="secondary" className="px-3 py-1">
                                            {time}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label className="mb-2 block">Study Days</Label>
                                <div className="flex flex-wrap gap-2">
                                    {userProfile.studyDays.map((day, index) => (
                                        <Badge key={index} variant="secondary" className="px-3 py-1">
                                            {day}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <Button variant="outline">Edit Study Schedule</Button>
                        </CardContent>
                    </Card>

                    {/* AI Learning Insights */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Brain className="w-5 h-5" />
                                AI Learning Insights
                            </CardTitle>
                            <CardDescription>Personalized insights based on your learning patterns</CardDescription>
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
