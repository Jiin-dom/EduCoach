import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ArrowRight, ArrowLeft, BookOpen, Eye, Headphones, PenTool, Loader2, Clock, Plus } from "lucide-react"

// Learning style options with descriptions
const learningStyles = [
    {
        id: "visual",
        label: "Visual Learner",
        description: "I learn best through images, diagrams, and visual representations",
        icon: Eye,
    },
    {
        id: "auditory",
        label: "Auditory Learner",
        description: "I learn best through listening and verbal explanations",
        icon: Headphones,
    },
    {
        id: "reading",
        label: "Reading/Writing Learner",
        description: "I learn best through reading texts and taking notes",
        icon: BookOpen,
    },
    {
        id: "kinesthetic",
        label: "Kinesthetic Learner",
        description: "I learn best through hands-on practice and examples",
        icon: PenTool,
    },
]

// Subject options
const subjectOptions = [
    "Computer Science",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Engineering",
    "Business",
    "Economics",
    "Psychology",
    "History",
    "Literature",
    "Languages",
    "Art & Design",
    "Other",
]

// Study goal options
const studyGoals = [
    { id: "exam_prep", label: "Exam Preparation", description: "Preparing for upcoming exams or certifications" },
    { id: "skill_building", label: "Skill Building", description: "Learning new skills for career or personal growth" },
    { id: "course_completion", label: "Course Completion", description: "Completing a specific course or degree" },
    { id: "general_learning", label: "General Learning", description: "Expanding knowledge in areas of interest" },
]

// Daily study time options (in minutes)
const studyTimeOptions = [
    { value: 15, label: "15 min", description: "Quick daily sessions" },
    { value: 30, label: "30 min", description: "Moderate pace" },
    { value: 60, label: "1 hour", description: "Dedicated study" },
    { value: 90, label: "1.5 hours", description: "Intensive learning" },
    { value: 120, label: "2+ hours", description: "Deep immersion" },
]

const dayOfWeekOptions = [
    { id: "mon", label: "Mon" },
    { id: "tue", label: "Tue" },
    { id: "wed", label: "Wed" },
    { id: "thu", label: "Thu" },
    { id: "fri", label: "Fri" },
    { id: "sat", label: "Sat" },
    { id: "sun", label: "Sun" },
]

// Generate 15-minute intervals for the time picker
const timeOptions = Array.from({ length: 24 * 4 }).map((_, i) => {
    const hour = Math.floor(i / 4)
    const minute = (i % 4) * 15
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    const displayMinute = minute.toString().padStart(2, '0')
    const value = `${hour.toString().padStart(2, '0')}:${displayMinute}`
    return {
        value,
        label: `${displayHour}:${displayMinute} ${ampm}`
    }
})

export function ProfilingForm() {
    const navigate = useNavigate()
    const { updateProfile } = useAuth()

    // Form state
    const [step, setStep] = useState(1)
    const [learningStyle, setLearningStyle] = useState<string>("")
    const [studyGoal, setStudyGoal] = useState<string>("")
    const [preferredSubjects, setPreferredSubjects] = useState<string[]>([])
    const [dailyStudyMinutes, setDailyStudyMinutes] = useState<number>(30)
    const [studyTimeStart, setStudyTimeStart] = useState<string>("18:00")
    const [studyTimeEnd, setStudyTimeEnd] = useState<string>("23:59")
    const [availableStudyDays, setAvailableStudyDays] = useState<string[]>([])
    const [displayName, setDisplayName] = useState<string>("")

    // Submission state
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const totalSteps = 5

    // Handle subject toggle
    const toggleSubject = (subject: string) => {
        setPreferredSubjects((prev) =>
            prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
        )
    }

    // Check if current step is valid
    const isStepValid = () => {
        switch (step) {
            case 1:
                return displayName.trim().length >= 2
            case 2:
                return learningStyle !== ""
            case 3:
                return studyGoal !== ""
            case 4:
                return preferredSubjects.length > 0
            case 5:
                return (
                    dailyStudyMinutes > 0 &&
                    studyTimeStart.trim() !== "" &&
                    studyTimeEnd.trim() !== "" &&
                    availableStudyDays.length > 0
                )
            default:
                return false
        }
    }

    // Handle form submission
    const handleSubmit = async () => {
        setIsSubmitting(true)
        setError(null)

        try {
            const { error: updateError } = await updateProfile({
                display_name: displayName.trim(),
                learning_style: learningStyle,
                study_goal: studyGoal,
                preferred_subjects: preferredSubjects,
                daily_study_minutes: dailyStudyMinutes,
                preferred_study_time_start: studyTimeStart,
                preferred_study_time_end: studyTimeEnd,
                available_study_days: availableStudyDays,
                has_completed_profiling: true,
            })

            if (updateError) {
                setError(updateError.message)
                return
            }

            // Success! Navigate to dashboard
            navigate("/dashboard")
        } catch (err) {
            setError("An unexpected error occurred. Please try again.")
            console.error("Profiling error:", err)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Handle next step
    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1)
        } else {
            handleSubmit()
        }
    }

    // Handle previous step
    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1)
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-xl">
                        Step {step} of {totalSteps}
                    </CardTitle>
                    <div className="flex gap-1">
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 w-8 rounded-full transition-colors ${
                                    i < step ? "bg-primary" : "bg-muted"
                                }`}
                            />
                        ))}
                    </div>
                </div>
                <CardDescription>
                    {step === 1 && "What should we call you?"}
                    {step === 2 && "How do you learn best?"}
                    {step === 3 && "What's your primary learning goal?"}
                    {step === 4 && "What subjects are you studying?"}
                    {step === 5 && "When do you want to study, and what days work?"}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Step 1: Display Name */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Your Name</Label>
                            <Input
                                id="displayName"
                                placeholder="Enter your name or nickname"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="text-lg py-6"
                                autoFocus
                            />
                            <p className="text-sm text-muted-foreground">
                                This is how we'll address you throughout your learning journey.
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 2: Learning Style */}
                {step === 2 && (
                    <RadioGroup value={learningStyle} onValueChange={setLearningStyle} className="space-y-3">
                        {learningStyles.map((style) => {
                            const Icon = style.icon
                            return (
                                <div key={style.id}>
                                    <RadioGroupItem value={style.id} id={style.id} className="peer sr-only" />
                                    <Label
                                        htmlFor={style.id}
                                        className="flex items-start gap-4 p-4 rounded-lg border cursor-pointer
                                            hover:bg-accent/50 peer-data-[state=checked]:border-primary 
                                            peer-data-[state=checked]:bg-primary/5 transition-all"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">{style.label}</p>
                                            <p className="text-sm text-muted-foreground">{style.description}</p>
                                        </div>
                                    </Label>
                                </div>
                            )
                        })}
                    </RadioGroup>
                )}

                {/* Step 3: Study Goal */}
                {step === 3 && (
                    <RadioGroup value={studyGoal} onValueChange={setStudyGoal} className="space-y-3">
                        {studyGoals.map((goal) => (
                            <div key={goal.id}>
                                <RadioGroupItem value={goal.id} id={goal.id} className="peer sr-only" />
                                <Label
                                    htmlFor={goal.id}
                                    className="flex flex-col p-4 rounded-lg border cursor-pointer
                                        hover:bg-accent/50 peer-data-[state=checked]:border-primary 
                                        peer-data-[state=checked]:bg-primary/5 transition-all"
                                >
                                    <p className="font-semibold">{goal.label}</p>
                                    <p className="text-sm text-muted-foreground">{goal.description}</p>
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                )}

                {/* Step 4: Preferred Subjects */}
                {step === 4 && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Select all subjects you're interested in:</p>
                        <div className="grid grid-cols-2 gap-3">
                            {subjectOptions.map((subject) => (
                                <div
                                    key={subject}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                                        hover:bg-accent/50 transition-all ${
                                            preferredSubjects.includes(subject)
                                                ? "border-primary bg-primary/5"
                                                : ""
                                        }`}
                                    onClick={() => toggleSubject(subject)}
                                >
                                    <Checkbox
                                        id={subject}
                                        checked={preferredSubjects.includes(subject)}
                                        onCheckedChange={() => toggleSubject(subject)}
                                    />
                                    <Label htmlFor={subject} className="cursor-pointer flex-1">
                                        {subject}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        {preferredSubjects.length > 0 && (
                            <p className="text-sm text-primary">
                                {preferredSubjects.length} subject{preferredSubjects.length > 1 ? "s" : ""} selected
                            </p>
                        )}
                    </div>
                )}

                {/* Step 5: Daily Study Time */}
                {step === 5 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-4 h-4 text-primary" />
                                <Label className="text-base font-bold">Study Time Window</Label>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="studyStart" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                        Starting At
                                    </Label>
                                    <Select value={studyTimeStart} onValueChange={setStudyTimeStart}>
                                        <SelectTrigger id="studyStart" className="h-12 text-base rounded-xl transition-all hover:border-primary/50">
                                            <SelectValue placeholder="Select start time" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-48">
                                            {timeOptions.map((opt) => (
                                                <SelectItem key={`start-${opt.value}`} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="studyEnd" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                        Ending At
                                    </Label>
                                    <Select value={studyTimeEnd} onValueChange={setStudyTimeEnd}>
                                        <SelectTrigger id="studyEnd" className="h-12 text-base rounded-xl transition-all hover:border-primary/50">
                                            <SelectValue placeholder="Select end time" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {timeOptions.map((opt) => (
                                                <SelectItem key={`end-${opt.value}`} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground italic">
                                Tip: We'll schedule your study sessions within this timeframe.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Plus className="w-4 h-4 text-primary" />
                                <Label className="text-base font-bold">Weekly Availability</Label>
                            </div>
                            <p className="text-sm text-muted-foreground">Select the days that work best for your schedule.</p>
                            <div className="flex flex-wrap gap-2">
                                {dayOfWeekOptions.map((d) => (
                                    <div
                                        key={d.id}
                                        className={`inline-flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                                            availableStudyDays.includes(d.id) 
                                                ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                                                : "bg-white hover:border-muted-foreground/30"
                                        }`}
                                        onClick={() => {
                                            const next = availableStudyDays.includes(d.id)
                                                ? availableStudyDays.filter((x) => x !== d.id)
                                                : [...availableStudyDays, d.id]
                                            setAvailableStudyDays(next)
                                        }}
                                    >
                                        <Checkbox
                                            id={`day-${d.id}`}
                                            checked={availableStudyDays.includes(d.id)}
                                            onCheckedChange={() => {}} // click handled by div
                                        />
                                        <Label htmlFor={`day-${d.id}`} className="cursor-pointer font-medium">
                                            {d.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            {availableStudyDays.length > 0 && (
                                <p className="text-sm text-primary font-medium">
                                    {availableStudyDays.length} day{availableStudyDays.length > 1 ? "s" : ""} selected
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Label className="block">Daily study minutes (15-120 min)</Label>
                            <RadioGroup
                                value={dailyStudyMinutes.toString()}
                                onValueChange={(val) => setDailyStudyMinutes(parseInt(val))}
                                className="space-y-3"
                            >
                                {studyTimeOptions.map((option) => (
                                    <div key={option.value}>
                                        <RadioGroupItem
                                            value={option.value.toString()}
                                            id={`time-${option.value}`}
                                            className="peer sr-only"
                                        />
                                        <Label
                                            htmlFor={`time-${option.value}`}
                                            className="flex items-center justify-between p-4 rounded-lg border cursor-pointer
                                                hover:bg-accent/50 peer-data-[state=checked]:border-primary 
                                                peer-data-[state=checked]:bg-primary/5 transition-all"
                                        >
                                            <div>
                                                <p className="font-semibold">{option.label}</p>
                                                <p className="text-sm text-muted-foreground">{option.description}</p>
                                            </div>
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        {error}
                    </div>
                )}

                {/* Navigation buttons */}
                <div className="flex justify-between pt-4">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={step === 1 || isSubmitting}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>

                    <Button
                        onClick={handleNext}
                        disabled={!isStepValid() || isSubmitting}
                        className="gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : step === totalSteps ? (
                            <>
                                Complete Setup
                                <ArrowRight className="w-4 h-4" />
                            </>
                        ) : (
                            <>
                                Next
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

