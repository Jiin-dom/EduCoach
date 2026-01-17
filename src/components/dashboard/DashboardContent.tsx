import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, Brain, Clock, TrendingUp, Eye, Trash2, Sparkles } from "lucide-react"
import { FileUploadDialog } from "@/components/files/FileUploadDialog"
import { QuizCard } from "@/components/dashboard/QuizCard"
import { ReadinessScoreCard } from "@/components/dashboard/ReadinessScoreCard"
import { TodaysStudyPlan } from "@/components/dashboard/TodaysStudyPlan"
import { WeakTopicsPanel } from "@/components/dashboard/WeakTopicsPanel"
import { MotivationalCard } from "@/components/dashboard/MotivationalCard"
import { AiTutorChat } from "@/components/shared/AiTutorChat"
import { Link } from "react-router-dom"

export function DashboardContent() {
    const [uploadedFiles, setUploadedFiles] = useState<
        Array<{ id: string; name: string; uploadedAt: string; size: string }>
    >([])
    const [showUploadDialog, setShowUploadDialog] = useState(false)

    const handleFileUpload = (file: File) => {
        const newFile = {
            id: Date.now().toString(),
            name: file.name,
            uploadedAt: new Date().toLocaleDateString(),
            size: `${(file.size / 1024).toFixed(2)} KB`,
        }
        setUploadedFiles([...uploadedFiles, newFile])
        setShowUploadDialog(false)
    }

    const handleDeleteFile = (fileId: string) => {
        setUploadedFiles(uploadedFiles.filter((file) => file.id !== fileId))
    }

    const handleViewFile = (fileName: string) => {
        alert(`Opening ${fileName}...`)
    }

    const handleGenerateQuiz = (fileName: string) => {
        alert(`Generating quiz from ${fileName}...`)
    }

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-8 text-primary-foreground">
                <h1 className="text-3xl font-bold mb-2">Welcome back, Student!</h1>
                <p className="text-primary-foreground/90 text-lg">Ready to continue your learning journey?</p>
            </div>

            {/* Stats Grid with Readiness Score */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Study Time</CardTitle>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12.5 hrs</div>
                        <p className="text-xs text-muted-foreground">This week</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Quizzes Completed</CardTitle>
                        <Brain className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">24</div>
                        <p className="text-xs text-muted-foreground">+3 from last week</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">87%</div>
                        <p className="text-xs text-muted-foreground">+5% improvement</p>
                    </CardContent>
                </Card>

                <ReadinessScoreCard />
            </div>

            <TodaysStudyPlan />

            {/* Main Content Grid with Weak Topics Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Uploaded Files Section */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Study Materials</CardTitle>
                        <CardDescription>Upload and manage your study files</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {uploadedFiles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <Upload className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="font-semibold mb-2">No files uploaded yet</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Upload your study materials to generate personalized quizzes
                                </p>
                                <Button onClick={() => setShowUploadDialog(true)}>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload File
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    {uploadedFiles.map((file) => (
                                        <div
                                            key={file.id}
                                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {file.uploadedAt} • {file.size}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleViewFile(file.name)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-primary hover:text-primary"
                                                    onClick={() => handleGenerateQuiz(file.name)}
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteFile(file.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button onClick={() => setShowUploadDialog(true)} variant="outline" className="w-full">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload More Files
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quizzes Section */}
                <Card className="lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Available Quizzes</CardTitle>
                            <CardDescription>Test your knowledge with AI-generated assessments</CardDescription>
                        </div>
                        <Link to="/quizzes">
                            <Button variant="outline" size="sm">
                                View All
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <QuizCard
                                id="1"
                                title="Introduction to Algorithms"
                                questions={15}
                                duration="20 min"
                                difficulty="Medium"
                                status="available"
                            />
                            <QuizCard
                                id="2"
                                title="Data Structures Fundamentals"
                                questions={20}
                                duration="30 min"
                                difficulty="Hard"
                                status="available"
                            />
                            <QuizCard
                                id="3"
                                title="Object-Oriented Programming"
                                questions={12}
                                duration="15 min"
                                difficulty="Easy"
                                status="completed"
                                score={92}
                            />
                        </div>
                    </CardContent>
                </Card>

                <WeakTopicsPanel />
            </div>

            <MotivationalCard />

            <FileUploadDialog open={showUploadDialog} onOpenChange={setShowUploadDialog} onUpload={handleFileUpload} />

            <AiTutorChat />
        </div>
    )
}
