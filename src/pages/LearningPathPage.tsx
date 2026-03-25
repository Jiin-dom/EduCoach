import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { LearningPathContent } from "@/components/learning-path/LearningPathContent"
import { LearningPathCalendar } from "@/components/learning-path/LearningPathCalendar"
import { StudyGoalsPanel } from "@/components/learning-path/StudyGoalsPanel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LearningPathPage() {
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            
            <Tabs defaultValue="schedule" className="w-full">
                <div className="container mx-auto px-4 pt-6 pb-2">
                    <TabsList className="bg-muted">
                        <TabsTrigger value="schedule">Schedule View</TabsTrigger>
                        <TabsTrigger value="mastery">Topics & Mastery</TabsTrigger>
                        <TabsTrigger value="goals">Study Goals</TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="schedule" className="m-0 border-0 p-0 outline-none">
                    <div className="container mx-auto px-4 py-2">
                        <LearningPathCalendar />
                    </div>
                </TabsContent>
                
                <TabsContent value="mastery" className="m-0 border-0 p-0 outline-none">
                    <LearningPathContent />
                </TabsContent>

                <TabsContent value="goals" className="m-0 border-0 p-0 outline-none">
                    <StudyGoalsPanel />
                </TabsContent>
            </Tabs>
        </div>
    )
}
