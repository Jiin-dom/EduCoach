import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft, Trophy } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

interface Question {
    id: string
    type: "multiple-choice" | "identification"
    question: string
    options?: string[]
    correctAnswer: string
}

const sampleQuizzes: Record<string, { title: string; questions: Question[] }> = {
    "1": {
        title: "Introduction to Algorithms",
        questions: [
            { id: "1", type: "multiple-choice", question: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], correctAnswer: "O(log n)" },
            { id: "2", type: "identification", question: "What sorting algorithm has an average time complexity of O(n log n) and is commonly used?", correctAnswer: "merge sort" },
            { id: "3", type: "multiple-choice", question: "Which data structure uses LIFO (Last In First Out)?", options: ["Queue", "Stack", "Array", "Linked List"], correctAnswer: "Stack" },
            { id: "4", type: "identification", question: "What is the term for an algorithm that calls itself?", correctAnswer: "recursion" },
        ],
    },
    "2": {
        title: "Data Structures Fundamentals",
        questions: [
            { id: "1", type: "multiple-choice", question: "Which data structure is best for implementing a priority queue?", options: ["Array", "Linked List", "Heap", "Stack"], correctAnswer: "Heap" },
            { id: "2", type: "identification", question: "What data structure uses nodes with pointers to connect elements?", correctAnswer: "linked list" },
        ],
    },
    "3": {
        title: "Object-Oriented Programming",
        questions: [
            { id: "1", type: "multiple-choice", question: "Which OOP principle allows a class to inherit properties from another class?", options: ["Encapsulation", "Inheritance", "Polymorphism", "Abstraction"], correctAnswer: "Inheritance" },
            { id: "2", type: "identification", question: "What is the term for hiding internal implementation details?", correctAnswer: "encapsulation" },
        ],
    },
}

export function QuizView() {
    const navigate = useNavigate()
    const { id } = useParams()
    const quizId = id || "1"
    const quiz = sampleQuizzes[quizId] || sampleQuizzes["1"]
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [showResults, setShowResults] = useState(false)

    const question = quiz.questions[currentQuestion]
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100

    const handleAnswer = (answer: string) => {
        setAnswers({ ...answers, [question.id]: answer })
    }

    const handleNext = () => {
        if (currentQuestion < quiz.questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1)
        }
    }

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1)
        }
    }

    const handleSubmit = () => {
        setShowResults(true)
    }

    const calculateScore = () => {
        let correct = 0
        quiz.questions.forEach((q) => {
            const userAnswer = answers[q.id]?.toLowerCase().trim()
            const correctAnswer = q.correctAnswer.toLowerCase().trim()
            if (userAnswer === correctAnswer) {
                correct++
            }
        })
        return Math.round((correct / quiz.questions.length) * 100)
    }

    const isAnswerCorrect = (questionId: string) => {
        const userAnswer = answers[questionId]?.toLowerCase().trim()
        const q = quiz.questions.find((q) => q.id === questionId)
        return userAnswer === q?.correctAnswer.toLowerCase().trim()
    }

    if (showResults) {
        const score = calculateScore()
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <Card>
                    <CardHeader className="text-center">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Trophy className="w-10 h-10 text-primary" />
                        </div>
                        <CardTitle className="text-3xl">Quiz Completed!</CardTitle>
                        <CardDescription>Here are your results</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="text-center">
                            <div className="text-6xl font-bold text-primary mb-2">{score}%</div>
                            <p className="text-muted-foreground">
                                You got {quiz.questions.filter((q) => isAnswerCorrect(q.id)).length} out of {quiz.questions.length} correct
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Review Answers</h3>
                            {quiz.questions.map((q, index) => (
                                <div key={q.id} className="p-4 rounded-lg border bg-card">
                                    <div className="flex items-start gap-3">
                                        {isAnswerCorrect(q.id) ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 space-y-2">
                                            <p className="font-medium">{index + 1}. {q.question}</p>
                                            <div className="text-sm space-y-1">
                                                <p>
                                                    <span className="text-muted-foreground">Your answer:</span>{" "}
                                                    <span className={isAnswerCorrect(q.id) ? "text-green-600" : "text-red-600"}>
                                                        {answers[q.id] || "Not answered"}
                                                    </span>
                                                </p>
                                                {!isAnswerCorrect(q.id) && (
                                                    <p>
                                                        <span className="text-muted-foreground">Correct answer:</span>{" "}
                                                        <span className="text-green-600">{q.correctAnswer}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <Button onClick={() => navigate("/quizzes")} className="flex-1">
                                Back to Quizzes
                            </Button>
                            <Button
                                onClick={() => {
                                    setCurrentQuestion(0)
                                    setAnswers({})
                                    setShowResults(false)
                                }}
                                variant="outline"
                                className="flex-1"
                            >
                                Retake Quiz
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{quiz.title}</h1>
                    <p className="text-muted-foreground">
                        Question {currentQuestion + 1} of {quiz.questions.length}
                    </p>
                </div>
                <Badge variant="secondary" className="text-sm">
                    {question.type === "multiple-choice" ? "Multiple Choice" : "Identification"}
                </Badge>
            </div>

            <Progress value={progress} className="h-2" />

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">{question.question}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {question.type === "multiple-choice" && question.options ? (
                        <RadioGroup value={answers[question.id]} onValueChange={handleAnswer}>
                            <div className="space-y-3">
                                {question.options.map((option, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent/5 cursor-pointer"
                                    >
                                        <RadioGroupItem value={option} id={`option-${index}`} />
                                        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                                            {option}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </RadioGroup>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="answer">Your Answer</Label>
                            <Input
                                id="answer"
                                placeholder="Type your answer here..."
                                value={answers[question.id] || ""}
                                onChange={(e) => handleAnswer(e.target.value)}
                                className="text-base"
                            />
                        </div>
                    )}

                    <div className="flex justify-between pt-4">
                        <Button onClick={handlePrevious} variant="outline" disabled={currentQuestion === 0}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Previous
                        </Button>

                        {currentQuestion === quiz.questions.length - 1 ? (
                            <Button onClick={handleSubmit} disabled={Object.keys(answers).length !== quiz.questions.length}>
                                Submit Quiz
                            </Button>
                        ) : (
                            <Button onClick={handleNext}>
                                Next
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-muted/50">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Questions Answered</span>
                        <span className="font-medium">
                            {Object.keys(answers).length} / {quiz.questions.length}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
