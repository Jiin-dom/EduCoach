import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { X, Plus } from "lucide-react"

const YEAR_LEVELS = ["College - 1st Year", "College - 2nd Year", "College - 3rd Year", "College - 4th Year"]
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

interface TimeRange {
    start: string
    end: string
}

export function ProfilingForm() {
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        yearLevel: "",
        course: "",
        studyTimes: [] as TimeRange[],
        studyDays: [] as string[],
    })
    const [currentStartTime, setCurrentStartTime] = useState("")
    const [currentEndTime, setCurrentEndTime] = useState("")

    const handleDayToggle = (day: string) => {
        setFormData((prev) => ({
            ...prev,
            studyDays: prev.studyDays.includes(day) ? prev.studyDays.filter((d) => d !== day) : [...prev.studyDays, day],
        }))
    }

    const handleAddTime = () => {
        if (currentStartTime && currentEndTime) {
            const start = new Date(`2000-01-01T${currentStartTime}`)
            const end = new Date(`2000-01-01T${currentEndTime}`)

            if (end <= start) {
                alert("End time must be after start time")
                return
            }

            const newTimeRange = { start: currentStartTime, end: currentEndTime }
            setFormData((prev) => ({
                ...prev,
                studyTimes: [...prev.studyTimes, newTimeRange],
            }))
            setCurrentStartTime("")
            setCurrentEndTime("")
        }
    }

    const handleRemoveTime = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            studyTimes: prev.studyTimes.filter((_, i) => i !== index),
        }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        localStorage.setItem("userProfile", JSON.stringify(formData))
        navigate("/dashboard")
    }

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(":")
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? "PM" : "AM"
        const displayHour = hour % 12 || 12
        return `${displayHour}:${minutes} ${ampm}`
    }

    const formatTimeRange = (timeRange: TimeRange) => {
        return `${formatTime(timeRange.start)} - ${formatTime(timeRange.end)}`
    }

    return (
        <Card className="border-2">
            <CardHeader>
                <CardTitle>Your Learning Profile</CardTitle>
                <CardDescription>Help us understand your academic background and study preferences</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="yearLevel">Year Level</Label>
                        <Select
                            value={formData.yearLevel}
                            onValueChange={(value) => setFormData({ ...formData, yearLevel: value })}
                        >
                            <SelectTrigger id="yearLevel">
                                <SelectValue placeholder="Select your current year level" />
                            </SelectTrigger>
                            <SelectContent>
                                {YEAR_LEVELS.map((level) => (
                                    <SelectItem key={level} value={level}>
                                        {level}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="course">
                            Course / Major <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="course"
                            type="text"
                            placeholder="e.g., Computer Science, Biology, Business Administration"
                            value={formData.course}
                            onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Preferred Study Times</Label>
                        <p className="text-sm text-muted-foreground">Add one or more time ranges when you prefer to study</p>
                        <div className="flex gap-2 items-center">
                            <div className="flex-1 flex items-center gap-2">
                                <Input
                                    id="startTime"
                                    type="time"
                                    value={currentStartTime}
                                    onChange={(e) => setCurrentStartTime(e.target.value)}
                                    placeholder="Start time"
                                />
                                <span className="text-muted-foreground">to</span>
                                <Input
                                    id="endTime"
                                    type="time"
                                    value={currentEndTime}
                                    onChange={(e) => setCurrentEndTime(e.target.value)}
                                    placeholder="End time"
                                />
                            </div>
                            <Button type="button" onClick={handleAddTime} disabled={!currentStartTime || !currentEndTime} size="icon">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {formData.studyTimes.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {formData.studyTimes.map((timeRange, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm"
                                    >
                                        <span>{formatTimeRange(timeRange)}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTime(index)}
                                            className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <Label>Preferred Study Days</Label>
                        <p className="text-sm text-muted-foreground">Select the days you typically study</p>
                        <div className="grid grid-cols-2 gap-3">
                            {DAYS_OF_WEEK.map((day) => (
                                <div key={day} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={day}
                                        checked={formData.studyDays.includes(day)}
                                        onCheckedChange={() => handleDayToggle(day)}
                                    />
                                    <Label htmlFor={day} className="cursor-pointer font-normal">
                                        {day}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={
                            !formData.yearLevel ||
                            !formData.course ||
                            formData.studyTimes.length === 0 ||
                            formData.studyDays.length === 0
                        }
                    >
                        Complete Profile & Continue
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
