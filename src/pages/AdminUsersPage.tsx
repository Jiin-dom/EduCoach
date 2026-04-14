import { AdminHeader } from "@/components/admin/AdminHeader"
import { UsersManagement } from "@/components/admin/UsersManagement"

export default function AdminUsersPage() {
  return (
    <div className="bg-background min-h-screen">
      <AdminHeader />
      <main className="container mx-auto px-4 py-8">
        <UsersManagement />
      </main>
    </div>
  )
}
