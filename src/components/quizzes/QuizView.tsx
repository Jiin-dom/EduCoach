import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
    CheckCircle2, XCircle, ArrowRight, ArrowLeft, Trophy,
    Loader2, AlertCircle, ArrowUpRight
} from "lucide-react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { useQuiz, useQuizQuestions, useSubmitAttempt } from "@/hooks/useQuizzes"
import type { QuizQuestion, AttemptAnswer } from "@/hooks/useQuizzes"

function questionTypeLabel(type: QuizQuestion['question_type']): string {
    switch (type) {
        case 'multiple_choice': return 'Multiple Choice'
        case 'identification': return 'Identification'
        case 'true_false': return 'True or False'
        case 'fill_in_blank': return 'Fill in the Blank'
        default: return type
    }
}

function isAnswerCorrect(question: QuizQuestion, userAnswer: string): boolean {
    if (!userAnswer) return false
    const ua = userAnswer.toLowerCase().trim()
    const ca = question.correct_answer.toLowerCase().trim()

    if (question.question_type === 'true_false') {
        return ua === ca
    }
    if (question.question_type === 'multiple_choice') {
        return ua === ca
    }
    // For identification and fill_in_blank, do a more lenient comparison
    return ua === ca || ca.includes(ua) || ua.includes(ca)
}

export function QuizView() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const startedAtRef = useRef(new Date().toISOString())

    const { data: quiz, isLoading: quizLoading, error: quizError } = useQuiz(id)
    const { data: questions, isLoading: questionsLoading } = useQuizQuestions(id)
    const submitAttempt = useSubmitAttempt()

    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [showResults, setShowResults] = useState(false)

    // Loading state
    if (quizLoading || questionsLoading) {
        return (
            <div className="max-w-3xl mx-auto">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                        <p className="text-muted-foreground">Loading quiz...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Error / not found
    if (quizError || !quiz) {
        return (
            <div className="max-w-3xl mx-auto">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-destructive">
                        <AlertCircle className="w-12 h-12 mb-4" />
                        <p className="text-lg font-medium">Quiz Not Found</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            {quizError instanceof Error ? quizError.message : 'This quiz does not exist or has been deleted.'}
                        </p>
                        <Button variant="outline" onClick={() => navigate('/quizzes')}>
                            Back to Quizzes
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Quiz still generating
    if (quiz.status === 'generating') {
        return (
            <div className="max-w-3xl mx-auto">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Generating Quiz...</h3>
                        <p className="text-muted-foreground text-center">
                            Your quiz is being generated from the document. This may take a minute.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Quiz errored
    if (quiz.status === 'error') {
        return (
            <div className="max-w-3xl mx-auto">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Quiz Generation Failed</h3>
                        <p className="text-sm text-muted-foreground text-center mb-4">
                            {quiz.error_message || 'An error occurred while generating the quiz.'}
                        </p>
                        <Button variant="outline" onClick={() => navigate('/quizzes')}>
                            Back to Quizzes
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // No questions
    if (!questions || questions.length === 0) {
        return (
            <div className="max-w-3xl mx-auto">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Questions</h3>
                        <p className="text-muted-foreground">This quiz has no questions.</p>
                        <Button variant="outline" className="mt-4" onClick={() => navigate('/quizzes')}>
                            Back to Quizzes
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const question = questions[currentQuestion]
    const progress = ((currentQuestion + 1) / questions.length) * 100

    const handleAnswer = (answer: string) => {
        setAnswers({ ...answers, [question.id]: answer })
    }

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1)
        }
    }

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1)
        }
    }

    const handleSubmit = () => {
        const attemptAnswers: AttemptAnswer[] = questions.map((q) => ({
            question_id: q.id,
            user_answer: answers[q.id] || '',
            is_correct: isAnswerCorrect(q, answers[q.id] || ''),
        }))
        const correctCount = attemptAnswers.filter((a) => a.is_correct).length
        const score = Math.round((correctCount / questions.length) * 100 * 100) / 100

        submitAttempt.mutate({
            quizId: quiz.id,
            answers: attemptAnswers,
            totalQuestions: questions.length,
            correctAnswers: correctCount,
            score,
            startedAt: startedAtRef.current,
        })

        setShowResults(true)
    }

    const calculateScore = () => {
        let correct = 0
        questions.forEach((q) => {
            if (isAnswerCorrect(q, answers[q.id] || '')) correct++
        })
        return Math.round((correct / questions.length) * 100)
    }

    // ─── Results View ────────────────────────────────────────────────────────

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
                        <CardDescription>Here are your results for "{quiz.title}"</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="text-center">
                            <div className="text-6xl font-bold text-primary mb-2">{score}%</div>
                            <p className="text-muted-foreground">
                                You got {questions.filter((q) => isAnswerCorrect(q, answers[q.id] || '')).length} out of {questions.length} correct
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Review Answers</h3>
                            {questions.map((q, index) => {
                                const userAns = answers[q.id] || ''
                                const correct = isAnswerCorrect(q, userAns)
                                return (
                                    <div key={q.id} className="p-4 rounded-lg border bg-card">
                                        <div className="flex items-start gap-3">
                                            {correct ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{index + 1}. {q.question_text}</p>
                                                    <Badge variant="outline" className="text-xs">
                                                        {questionTypeLabel(q.question_type)}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm space-y-1">
                                                    <p>
                                                        <span className="text-muted-foreground">Your answer:</span>{" "}
                                                        <span className={correct ? "text-green-600" : "text-red-600"}>
                                                            {userAns || "Not answered"}
                                                        </span>
                                                    </p>
                                                    {!correct && (
                                                        <p>
                                                            <span className="text-muted-foreground">Correct answer:</span>{" "}
                                                            <span className="text-green-600">{q.correct_answer}</span>
                                                        </p>
                                                    )}
                                                    {q.explanation && (
                                                        <p className="text-muted-foreground italic mt-1">
                                                            {q.explanation}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
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
                                    startedAtRef.current = new Date().toISOString()
                                }}
                                variant="outline"
                                className="flex-1"
                            >
                                Retake Quiz
                            </Button>
                        </div>

                        {quiz.document_id && (
                            <Link
                                to={`/files/${quiz.document_id}`}
                                className="flex items-center justify-center gap-1 text-sm text-primary hover:underline"
                            >
                                View Source Document
                                <ArrowUpRight className="w-3 h-3" />
                            </Link>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    // ─── Quiz Taking View ────────────────────────────────────────────────────

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{quiz.title}</h1>
                    <p className="text-muted-foreground">
                        Question {currentQuestion + 1} of {questions.length}
                    </p>
                </div>
                <Badge variant="secondary" className="text-sm">
                    {questionTypeLabel(question.question_type)}
                </Badge>
            </div>

            <Progress value={progress} className="h-2" />

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">{question.question_text}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* Multiple Choice */}
                    {question.question_type === "multiple_choice" && question.options && (
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
                    )}

                    {/* True / False */}
                    {question.question_type === "true_false" && (
                        <RadioGroup value={answers[question.id]} onValueChange={handleAnswer}>
                            <div className="space-y-3">
                                {["true", "false"].map((val) => (
                                    <div
                                        key={val}
                                        className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent/5 cursor-pointer"
                                    >
                                        <RadioGroupItem value={val} id={`tf-${val}`} />
                                        <Label htmlFor={`tf-${val}`} className="flex-1 cursor-pointer capitalize">
                                            {val}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </RadioGroup>
                    )}

                    {/* Identification */}
                    {question.question_type === "identification" && (
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

                    {/* Fill in the Blank */}
                    {question.question_type === "fill_in_blank" && (
                        <div className="space-y-2">
                            <Label htmlFor="blank-answer">Fill in the blank</Label>
                            <Input
                                id="blank-answer"
                                placeholder="Type the missing word or phrase..."
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

                        {currentQuestion === questions.length - 1 ? (
                            <Button
                                onClick={handleSubmit}
                                disabled={Object.keys(answers).length !== questions.length || submitAttempt.isPending}
                            >
                                {submitAttempt.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : null}
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
                            {Object.keys(answers).length} / {questions.length}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
