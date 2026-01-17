import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
    TrendingUp,
    Clock,
    Target,
    Brain,
    Calendar,
    ArrowUp,
    Flame,
    BookOpen,
    AlertTriangle,
    BarChart3,
} from "lucide-react"

export function AnalyticsContent() {
    const weeklyStats = {
        studyTime: 12.5,
        quizzesCompleted: 8,
        averageScore: 87,
        streak: 5,
    }

    const subjectPerformance = [
        { subject: "Computer Science", score: 92, quizzes: 12, trend: "up" },
        { subject: "Mathematics", score: 78, quizzes: 8, trend: "up" },
        { subject: "Physics", score: 71, quizzes: 6, trend: "down" },
        { subject: "Database", score: 85, quizzes: 10, trend: "up" },
    ]

    const weakTopics = [
        { topic: "Thermodynamics", subject: "Physics", accuracy: 58 },
        { topic: "Integration", subject: "Mathematics", accuracy: 62 },
        { topic: "Grammar Rules", subject: "English", accuracy: 65 },
    ]

    const recentQuizzes = [
        { title: "Algorithms Quiz", score: 92, date: "Jan 15", subject: "Computer Science" },
        { title: "Calculus Test", score: 78, date: "Jan 14", subject: "Mathematics" },
        { title: "SQL Basics", score: 95, date: "Jan 13", subject: "Database" },
        { title: "Physics Quiz", score: 68, date: "Jan 12", subject: "Physics" },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground">Track your learning progress and performance</p>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Study Time</CardTitle>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{weeklyStats.studyTime} hrs</div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <ArrowUp className="w-3 h-3" />
                            <span>+2.5 hrs from last week</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Quizzes Completed</CardTitle>
                        <Brain className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{weeklyStats.quizzesCompleted}</div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <ArrowUp className="w-3 h-3" />
                            <span>+3 from last week</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                        <Target className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{weeklyStats.averageScore}%</div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <ArrowUp className="w-3 h-3" />
                            <span>+5% improvement</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
                        <Flame className="w-4 h-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{weeklyStats.streak} days</div>
                        <p className="text-xs text-muted-foreground">Keep it up!</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="performance" className="w-full">
                <TabsList className="grid w-full max-w-lg grid-cols-3">
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="weak-topics">Weak Topics</TabsTrigger>
                    <TabsTrigger value="history">Quiz History</TabsTrigger>
                </TabsList>

                <TabsContent value="performance" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Subject Performance</CardTitle>
                            <CardDescription>Your performance across different subjects</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {subjectPerformance.map((subject) => (
                                    <div key={subject.subject} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <BookOpen className="w-4 h-4 text-primary" />
                                                <span className="font-medium">{subject.subject}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="secondary">{subject.quizzes} quizzes</Badge>
                                                <span className="font-bold text-lg">{subject.score}%</span>
                                                {subject.trend === "up" ? (
                                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
                                                )}
                                            </div>
                                        </div>
                                        <Progress value={subject.score} className="h-2" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Performance Chart Placeholder */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Weekly Progress</CardTitle>
                            <CardDescription>Your study activity over the past week</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64 flex items-end justify-around gap-2 px-4">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => {
                                    const heights = [60, 80, 45, 90, 70, 40, 20]
                                    return (
                                        <div key={day} className="flex flex-col items-center gap-2 flex-1">
                                            <div
                                                className="w-full bg-primary/80 rounded-t-lg transition-all hover:bg-primary"
                                                style={{ height: `${heights[index]}%` }}
                                            />
                                            <span className="text-xs text-muted-foreground">{day}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="weak-topics" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                                Topics Needing Attention
                            </CardTitle>
                            <CardDescription>These topics have lower accuracy scores and need more practice</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {weakTopics.map((topic, index) => (
                                    <div key={index} className="p-4 rounded-lg border bg-orange-500/5 border-orange-500/20">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="font-semibold">{topic.topic}</p>
                                                <p className="text-sm text-muted-foreground">{topic.subject}</p>
                                            </div>
                                            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                                                {topic.accuracy}% accuracy
                                            </Badge>
                                        </div>
                                        <Progress value={topic.accuracy} className="h-2" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Quizzes</CardTitle>
                            <CardDescription>Your most recent quiz attempts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {recentQuizzes.map((quiz, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Brain className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">{quiz.title}</p>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <span>{quiz.subject}</span>
                                                    <span>•</span>
                                                    <Calendar className="w-3 h-3" />
                                                    <span>{quiz.date}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-2xl font-bold ${quiz.score >= 80 ? "text-green-600" : quiz.score >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                                                {quiz.score}%
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
