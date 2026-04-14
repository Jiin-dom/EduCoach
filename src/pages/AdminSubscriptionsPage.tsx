import { AdminHeader } from "@/components/admin/AdminHeader"
import { SubscriptionsManagement } from "@/components/admin/SubscriptionsManagement"

export default function AdminSubscriptionsPage() {
  return (
    <div className="bg-background min-h-screen">
      <AdminHeader />
      <main className="container mx-auto px-4 py-8">
        <SubscriptionsManagement />
      </main>
    </div>
  )
}
