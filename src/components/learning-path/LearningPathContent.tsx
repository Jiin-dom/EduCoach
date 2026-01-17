import { useState } from "react"
import {
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    FileQuestion,
    Brain,
    Clock,
    Calendar,
    Target,
    BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type SessionType = "study" | "quiz" | "review"

interface StudySession {
    id: string
    type: SessionType
    subject: string
    topic: string
    startTime: string
    endTime: string
    status: "scheduled" | "completed" | "missed"
}

interface DaySchedule {
    day: string
    date: string
    sessions: StudySession[]
}

export function LearningPathContent() {
    const [currentWeek, setCurrentWeek] = useState(0)

    const weeklySchedule: DaySchedule[] = [
        {
            day: "Monday",
            date: "Jan 15",
            sessions: [
                { id: "1", type: "study", subject: "Computer Science", topic: "Algorithms Chapter 3", startTime: "08:00", endTime: "09:30", status: "completed" },
                { id: "2", type: "quiz", subject: "Computer Science", topic: "Algorithms Quiz", startTime: "14:00", endTime: "14:30", status: "completed" },
            ],
        },
        {
            day: "Tuesday",
            date: "Jan 16",
            sessions: [
                { id: "3", type: "study", subject: "Mathematics", topic: "Calculus: Integration", startTime: "09:00", endTime: "10:30", status: "completed" },
                { id: "4", type: "review", subject: "Computer Science", topic: "Data Structures Review", startTime: "15:00", endTime: "16:00", status: "scheduled" },
            ],
        },
        {
            day: "Wednesday",
            date: "Jan 17",
            sessions: [
                { id: "5", type: "study", subject: "Physics", topic: "Thermodynamics", startTime: "10:00", endTime: "11:30", status: "scheduled" },
                { id: "6", type: "quiz", subject: "Mathematics", topic: "Calculus Quiz", startTime: "14:00", endTime: "14:45", status: "scheduled" },
            ],
        },
        {
            day: "Thursday",
            date: "Jan 18",
            sessions: [
                { id: "7", type: "study", subject: "Database", topic: "SQL Fundamentals", startTime: "09:00", endTime: "10:30", status: "scheduled" },
            ],
        },
        {
            day: "Friday",
            date: "Jan 19",
            sessions: [
                { id: "8", type: "review", subject: "Physics", topic: "Thermodynamics Review", startTime: "11:00", endTime: "12:00", status: "scheduled" },
                { id: "9", type: "quiz", subject: "Database", topic: "SQL Quiz", startTime: "15:00", endTime: "15:30", status: "scheduled" },
            ],
        },
        {
            day: "Saturday",
            date: "Jan 20",
            sessions: [
                { id: "10", type: "study", subject: "Web Development", topic: "React Components", startTime: "10:00", endTime: "12:00", status: "scheduled" },
            ],
        },
        {
            day: "Sunday",
            date: "Jan 21",
            sessions: [],
        },
    ]

    const getSessionIcon = (type: SessionType) => {
        switch (type) {
            case "study":
                return <BookOpen className="w-4 h-4" />
            case "quiz":
                return <FileQuestion className="w-4 h-4" />
            case "review":
                return <Brain className="w-4 h-4" />
        }
    }

    const getSessionColor = (type: SessionType, status: string) => {
        if (status === "completed") return "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
        if (status === "missed") return "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"

        switch (type) {
            case "study":
                return "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400"
            case "quiz":
                return "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400"
            case "review":
                return "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400"
        }
    }

    const completedSessions = weeklySchedule.flatMap((d) => d.sessions).filter((s) => s.status === "completed").length
    const totalSessions = weeklySchedule.flatMap((d) => d.sessions).length
    const weekProgress = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Learning Path</h1>
                            <p className="text-muted-foreground">Your personalized study schedule</p>
                        </div>
                    </div>
                </div>

                {/* Week Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Week Progress</CardTitle>
                            <Target className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{Math.round(weekProgress)}%</div>
                            <Progress value={weekProgress} className="mt-2" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Study Sessions</CardTitle>
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{weeklySchedule.flatMap((d) => d.sessions).filter((s) => s.type === "study").length}</div>
                            <p className="text-xs text-muted-foreground">This week</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
                            <FileQuestion className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{weeklySchedule.flatMap((d) => d.sessions).filter((s) => s.type === "quiz").length}</div>
                            <p className="text-xs text-muted-foreground">Scheduled</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Reviews</CardTitle>
                            <Brain className="w-4 h-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{weeklySchedule.flatMap((d) => d.sessions).filter((s) => s.type === "review").length}</div>
                            <p className="text-xs text-muted-foreground">Planned</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Week Navigation */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Weekly Schedule</CardTitle>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(currentWeek - 1)}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-sm font-medium px-4">
                                    Week of Jan {15 + currentWeek * 7}, 2024
                                </span>
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(currentWeek + 1)}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <CardDescription>Your study sessions for this week</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                            {weeklySchedule.map((day) => (
                                <div key={day.day} className="space-y-3">
                                    <div className="text-center pb-2 border-b">
                                        <p className="font-semibold">{day.day}</p>
                                        <p className="text-sm text-muted-foreground">{day.date}</p>
                                    </div>
                                    <div className="space-y-2 min-h-[200px]">
                                        {day.sessions.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-4">No sessions</p>
                                        ) : (
                                            day.sessions.map((session) => (
                                                <div
                                                    key={session.id}
                                                    className={`p-3 rounded-lg border ${getSessionColor(session.type, session.status)}`}
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {getSessionIcon(session.type)}
                                                        <span className="text-xs font-medium capitalize">{session.type}</span>
                                                        {session.status === "completed" && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                                                    </div>
                                                    <p className="text-xs font-semibold mb-1">{session.subject}</p>
                                                    <p className="text-xs opacity-80 mb-2">{session.topic}</p>
                                                    <div className="flex items-center gap-1 text-xs opacity-70">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{session.startTime} - {session.endTime}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-blue-500/30" />
                        <span className="text-sm text-muted-foreground">Study Session</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-purple-500/30" />
                        <span className="text-sm text-muted-foreground">Quiz</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-orange-500/30" />
                        <span className="text-sm text-muted-foreground">Review</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-green-500/30" />
                        <span className="text-sm text-muted-foreground">Completed</span>
                    </div>
                </div>
            </div>
        </main>
    )
}
