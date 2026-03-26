import { useState, useMemo } from "react"
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    CalendarDays,
    Plus,
    Clock,
    CheckCircle2,
    BookOpen,
    Filter,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    useConceptMasteryList,
    useLearningStats,
    useRescheduleConceptDueDate,
    useStudyEfficiency,
    type ConceptMasteryWithDetails,
} from "@/hooks/useLearning"
import { useWeeklyProgress } from "@/hooks/useLearningProgress"

// Helper function to get days in a month
function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function formatDateToLocalString(d: Date) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
}

export function LearningPathCalendar() {
    const [viewMode, setViewMode] = useState<"week" | "month">("week")

    // Filter toggles
    const [showMastered, setShowMastered] = useState(true)
    const [showDeveloping, setShowDeveloping] = useState(true)
    const [showNeedsReview, setShowNeedsReview] = useState(true)

    const { data: masteryList } = useConceptMasteryList();
    const { data: stats } = useLearningStats();
    const { data: weeklyProgress } = useWeeklyProgress();
    const { data: efficiency } = useStudyEfficiency();
    const rescheduleDueDate = useRescheduleConceptDueDate()

    // Compute Dates
    const now = new Date();
    // Week calculations
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0 for Monday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0,0,0,0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    const monthDaysCount = getDaysInMonth(now.getFullYear(), now.getMonth());
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    // Monday is 1, Sunday is 0. If we grid starts at Sunday, week array: Sun=0 to Sat=6.
    // The image grid is Sun, Mon, Tue, Wed, Thu, Fri, Sat.
    const emptyCellsBefore = firstDayOfMonth; // If Sun, it's 0. If Mon, it's 1.

    // Session logic
    const getSessionsForDate = (dateStr: string) => {
        if (!masteryList) return [];
        return masteryList
            .filter(m => m.due_date === dateStr)
            .filter(m => {
                if (m.display_mastery_level === 'mastered') return showMastered;
                if (m.display_mastery_level === 'developing') return showDeveloping;
                if (m.display_mastery_level === 'needs_review') return showNeedsReview;
                return true;
            })
    }

    // Helper to render pills based on session type
    const renderSessionBadge = (session: ConceptMasteryWithDetails) => {
        let colors = ""
        switch (session.display_mastery_level) {
            case "mastered": colors = "bg-green-100 text-green-700 border-green-200"; break;
            case "developing": colors = "bg-yellow-100 text-yellow-700 border-yellow-200"; break;
            case "needs_review": colors = "bg-red-100 text-red-700 border-red-200"; break;
            default: colors = "bg-gray-100 text-gray-700 border-gray-200"; break;
        }

        return (
            <div
                draggable
                onDragStart={(e) => {
                    // Store the concept being moved; on drop we resolve masteryScore/confidence from `masteryList`.
                    e.dataTransfer.setData('text/plain', session.concept_id)
                    e.dataTransfer.effectAllowed = 'move'
                }}
                className={`p-2 rounded-md border text-xs mb-2 ${colors} cursor-grab active:cursor-grabbing`}
                title="Drag to reschedule review deadline"
            >
                <div className="flex items-center gap-1 font-medium mb-1 truncate">
                    {session.display_mastery_level === 'mastered' && <CheckCircle2 className="w-3 h-3" />}
                    {session.display_mastery_level === 'developing' && <Clock className="w-3 h-3" />} {/* changed from Flashcard icon */} 
                    {session.display_mastery_level === 'needs_review' && <BookOpen className="w-3 h-3" />}
                    {session.concept_name}
                </div>
                {/* Time was omitted based on the plan */}
            </div>
        )
    }

    const renderMonthSessionBadge = (session: ConceptMasteryWithDetails) => {
        let colors = ""
        switch (session.display_mastery_level) {
            case "mastered": colors = "bg-green-100 text-green-700 border-green-200"; break;
            case "developing": colors = "bg-yellow-100 text-yellow-700 border-yellow-200"; break;
            case "needs_review": colors = "bg-red-100 text-red-700 border-red-200"; break;
            default: colors = "bg-gray-100 text-gray-700 border-gray-200"; break;
        }
        return (
            <div
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', session.concept_id)
                    e.dataTransfer.effectAllowed = 'move'
                }}
                className={`mt-1 text-[10px] p-1 rounded truncate border flex items-center gap-1 ${colors} cursor-grab active:cursor-grabbing`}
                title="Drag to reschedule review deadline"
            >
                {session.display_mastery_level === 'mastered' && <CheckCircle2 className="w-2.5 h-2.5 hidden sm:block" />}
                {session.display_mastery_level === 'developing' && <Clock className="w-2.5 h-2.5 hidden sm:block" />}
                {session.display_mastery_level === 'needs_review' && <BookOpen className="w-2.5 h-2.5 hidden sm:block" />}
                <span>{session.concept_name}</span>
            </div>
        )
    }

    const handleRescheduleDrop = (conceptId: string, targetDateStr: string) => {
        if (!conceptId || !targetDateStr) return
        if (!masteryList) return

        const current = masteryList.find((m) => m.concept_id === conceptId)
        if (!current) return
        if (current.due_date === targetDateStr) return // no-op

        rescheduleDueDate.mutate({
            conceptId,
            newDueDate: targetDateStr,
            masteryScore: Number(current.mastery_score),
            confidence: Number(current.confidence),
        })
    }

    // Identify weak concepts for deadlines/goals module
    const weakConcepts = useMemo(() => {
        if (!masteryList) return [];
        return [...masteryList]
            .filter(m => m.display_mastery_level === 'needs_review')
            .sort((a,b) => a.display_mastery_score - b.display_mastery_score)
            .slice(0, 3);
    }, [masteryList]);

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div>
                <h1 className="text-3xl font-bold mb-1">My Learning Path</h1>
                <p className="text-muted-foreground">View your adaptive study schedule based on your preferred time.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                
                {/* Left Column: Calendar & Content */}
                <div className="flex-1 w-full space-y-6">
                    
                    {/* Calendar Card */}
                    <Card>
                        <CardHeader className="pb-4">
                            {/* Calendar Navigator */}
                            <div className="flex items-center justify-between mb-4">
                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="text-center">
                                    <h3 className="font-semibold text-base sm:text-lg">
                                        {viewMode === 'week' ? `Week of ${startOfWeek.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${endOfWeek.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}, ${now.getFullYear()}` : `${now.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}`}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">Your preferred study time: 6 PM - 12 AM</p>
                                </div>
                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* View Toggles */}
                            <div className="bg-muted p-1 rounded-xl grid grid-cols-2 gap-1 w-full max-w-md mx-auto">
                                <button 
                                    onClick={() => setViewMode("week")}
                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    Week View
                                </button>
                                <button 
                                    onClick={() => setViewMode("month")}
                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'month' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Calendar className="h-4 w-4" />
                                    Month View
                                </button>
                            </div>
                        </CardHeader>
                        
                        <CardContent>
                            {/* Calendar Grids */}
                            {viewMode === "week" ? (
                                /* Week Layout */
                                <div className="flex overflow-x-auto pb-4 gap-4 snap-x hide-scrollbar">
                                    {weekDays.map((dateObj, idx) => {
                                        const dateStr = formatDateToLocalString(dateObj)
                                        const sessions = getSessionsForDate(dateStr)

                                        return (
                                        <div
                                            key={idx}
                                            className="min-w-[140px] flex-1 border rounded-xl p-3 snap-start bg-card min-h-[200px]"
                                            onDragOver={(e) => {
                                                // Must preventDefault to allow dropping.
                                                e.preventDefault()
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault()
                                                if (rescheduleDueDate.isPending) return
                                                const conceptId = e.dataTransfer.getData('text/plain')
                                                handleRescheduleDrop(conceptId, dateStr)
                                            }}
                                        >
                                            <div className="mb-3">
                                                <div className="font-medium text-sm">{dateObj.toLocaleDateString('en-US', {weekday: 'long'})}</div>
                                                <div className="text-xs text-muted-foreground">{dateObj.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</div>
                                            </div>
                                            <div className="space-y-2">
                                                {sessions.length > 0 ? (
                                                    sessions.map((s, i) => <div key={i}>{renderSessionBadge(s)}</div>)
                                                ) : (
                                                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground py-8 text-center text-balance">
                                                        No topics due
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            ) : (
                                /* Month Layout */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium mb-2">
                                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-2">
                                        {Array.from({length: emptyCellsBefore}).map((_, i) => (
                                            <div key={`empty-${i}`} className="aspect-square p-2 border rounded-lg bg-card/50"></div>
                                        ))}
                                        {/* Creating an array of 31 days */}
                                        {Array.from({length: monthDaysCount}).map((_, i) => {
                                            const dayDate = new Date(now.getFullYear(), now.getMonth(), i + 1);
                                            const dateStr = formatDateToLocalString(dayDate);
                                            const sessions = getSessionsForDate(dateStr);

                                            return (
                                            <div
                                                key={i}
                                                className="aspect-square p-1.5 sm:p-2 border rounded-lg bg-card relative min-h-[60px] sm:min-h-[80px] overflow-hidden"
                                                onDragOver={(e) => {
                                                    e.preventDefault()
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault()
                                                    if (rescheduleDueDate.isPending) return
                                                    const conceptId = e.dataTransfer.getData('text/plain')
                                                    handleRescheduleDrop(conceptId, dateStr)
                                                }}
                                            >
                                                <span className="text-xs font-medium">{i + 1}</span>
                                                {sessions.slice(0, 3).map((s, si) => (
                                                    <div key={si}>{renderMonthSessionBadge(s)}</div>
                                                ))}
                                                {sessions.length > 3 && (
                                                    <div className="mt-1 text-[10px] text-muted-foreground px-1 truncate">
                                                        +{sessions.length - 3} more
                                                    </div>
                                                )}
                                            </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI Recommendations */}
                    <Card className="bg-purple-50/50 border-purple-100">
                        <CardContent className="p-6">
                            <h3 className="font-semibold mb-2">AI Recommendations</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {weeklyProgress && weeklyProgress.questionsAnswered > 0 
                                    ? `You've completed ${weeklyProgress.questionsAnswered} tasks this week! Keep up the great work.` 
                                    : `You don't have any reviews yet this week. Remember, spaced repetition is the key to mastery!`} 
                                {(stats?.needsReviewCount ?? 0) > 0 && ` Consider adding a review session for some weak topics.`}
                            </p>
                            <Button className="bg-purple-500 hover:bg-purple-600 text-white border-0 shadow-sm">
                                Reschedule Automatically
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="text-center text-xs text-muted-foreground pb-4">
                        All sessions synced with your adaptive study plan.
                    </div>
                </div>

                {/* Right Column: Sidebar Widgets */}
                <div className="w-full lg:w-80 space-y-6">
                    
                    {/* Deadlines & Goals */}
                    <Card>
                        <CardHeader className="pb-3 flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Upcoming Reviews
                            </CardTitle>
                            <Button variant="outline" size="sm" className="h-7 text-xs rounded-full px-3">
                                <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {weakConcepts.length > 0 ? weakConcepts.map((d, i) => (
                                <div key={i} className="border rounded-lg p-3">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-medium text-sm grid-cols-1 truncate pr-2">{d.concept_name}</h4>
                                        <Badge variant="secondary" className="bg-red-100 text-red-800 text-[10px] shrink-0 font-medium whitespace-nowrap">
                                            Needs Review
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-2">{d.document_title || 'General Concept'}</p>
                                    <div className="flex items-center gap-1 text-[10px] text-orange-500 font-medium">
                                        <Clock className="w-3 h-3" />
                                        Expected: {d.due_date}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-sm text-muted-foreground p-2">No weak topics found! Great job.</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Filters & Legend */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                Filters & Legend
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border border-green-300 bg-green-100"></div>
                                    <span className="text-sm font-medium">Mastered</span>
                                </div>
                                <Switch checked={showMastered} onCheckedChange={setShowMastered} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border border-yellow-300 bg-yellow-100"></div>
                                    <span className="text-sm font-medium">Developing</span>
                                </div>
                                <Switch checked={showDeveloping} onCheckedChange={setShowDeveloping} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border border-red-300 bg-red-100"></div>
                                    <span className="text-sm font-medium">Needs Review</span>
                                </div>
                                <Switch checked={showNeedsReview} onCheckedChange={setShowNeedsReview} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Weekly Summary */}
                    <Card>
                        <CardHeader className="pb-3 bg-muted/50 rounded-t-xl">
                            <CardTitle className="text-sm font-semibold">Weekly Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4 bg-muted/20 border-t-0">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Concepts Mastered (All Time)</p>
                                <p className="text-xl font-bold text-purple-600">{stats?.masteredCount ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Total Study Hours (30d)</p>
                                <p className="text-xl font-bold text-purple-600">
                                    {efficiency ? (efficiency.totalTimeMinutes / 60).toFixed(1) : '0'} hrs
                                </p>
                            </div>
                            <div className="pt-2 border-t text-sm">
                                <p className="text-muted-foreground text-xs mb-1">Study Streak</p>
                                <p className="font-medium">{stats?.studyStreak ?? 0} {stats?.studyStreak === 1 ? 'day' : 'days'} tracking</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start text-sm">
                                <BookOpen className="w-4 h-4 mr-2" /> View All Quizzes
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-sm">
                                <Clock className="w-4 h-4 mr-2" /> Practice Flashcards
                            </Button>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    )
}
