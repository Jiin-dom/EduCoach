import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { SubscriptionContent } from "@/components/subscription/SubscriptionContent"

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <SubscriptionContent />
      </main>
    </div>
  )
}
