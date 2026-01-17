import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Clock } from "lucide-react"

interface StudyTask {
    id: string
    title: string
    duration: string
    completed: boolean
    progress: number
}

export function TodaysStudyPlan() {
    const [tasks, setTasks] = useState<StudyTask[]>([
        { id: "1", title: "Review Chapter 3: Ecology", duration: "30 min", completed: false, progress: 0 },
        { id: "2", title: "Take Quiz: Logic and Reasoning", duration: "15 min", completed: false, progress: 0 },
        { id: "3", title: "Flashcards: 10 due today", duration: "10 min", completed: false, progress: 0 },
    ])

    const handleToggleTask = (taskId: string) => {
        setTasks(
            tasks.map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed, progress: !task.completed ? 100 : 0 } : task,
            ),
        )
    }

    const completedTasks = tasks.filter((task) => task.completed).length
    const totalProgress = (completedTasks / tasks.length) * 100

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Today's Study Plan</CardTitle>
                    <span className="text-sm text-muted-foreground">
                        {completedTasks}/{tasks.length} completed
                    </span>
                </div>
                <Progress value={totalProgress} className="mt-2" />
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {tasks.map((task) => (
                        <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                            <Checkbox checked={task.completed} onCheckedChange={() => handleToggleTask(task.id)} className="mt-1" />
                            <div className="flex-1">
                                <p className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                                    {task.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{task.duration}</span>
                                </div>
                                {!task.completed && task.progress > 0 && <Progress value={task.progress} className="mt-2 h-1" />}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
