import { useMemo, useState } from "react"
import { Search, Settings2, Trash2, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"

import { AddUserModal, type AddUserFormData } from "@/components/admin/AddUserModal"
import { DeleteUserModal, type ManagedUser } from "@/components/admin/DeleteUserModal"
import { EditSubscriptionModal, type ManagedSubscription } from "@/components/admin/EditSubscriptionModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminUsers, useCreateAdminUser, useDeleteAdminUser } from "@/hooks/useAdminUsers"
import { useUpdateAdminSubscription } from "@/hooks/useAdminSubscriptions"
import { getPlanDisplayName } from "@/lib/subscription"

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function mapAdminUserToTableRow(user: {
  id: string
  email: string | null
  display_name: string | null
  role: "student" | "admin"
  subscription_plan: "free" | "premium"
  subscription_status: "active" | "cancelled" | "suspended"
  has_completed_profiling: boolean
  created_at: string
}): ManagedUser {
  const fallbackName = user.email?.split("@")[0] ?? "Unknown User"

  return {
    id: user.id,
    name: user.display_name?.trim() || fallbackName,
    email: user.email ?? "No email",
    role: user.role,
    subscriptionPlan: user.subscription_plan,
    subscriptionStatus: user.subscription_status,
    hasCompletedProfiling: user.has_completed_profiling,
    joinedAt: user.created_at,
  }
}

export function UsersManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [deleteUserOpen, setDeleteUserOpen] = useState(false)
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null)
  const [selectedSubscription, setSelectedSubscription] = useState<ManagedSubscription | null>(null)

  const usersQuery = useAdminUsers()
  const createUserMutation = useCreateAdminUser()
  const deleteUserMutation = useDeleteAdminUser()
  const updateSubscriptionMutation = useUpdateAdminSubscription()

  const tableUsers = useMemo<ManagedUser[]>(() => {
    return (usersQuery.data ?? []).map(mapAdminUserToTableRow)
  }, [usersQuery.data])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return tableUsers

    return tableUsers.filter((user) => {
      return user.name.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery)
    })
  }, [searchQuery, tableUsers])

  const handleDeleteUser = (user: ManagedUser) => {
    setSelectedUser(user)
    setDeleteUserOpen(true)
  }

  const handleManageSubscription = (user: ManagedUser) => {
    setSelectedSubscription({
      userId: user.id,
      userName: user.name,
      email: user.email,
      plan: user.subscriptionPlan,
      status: user.subscriptionStatus,
      amountPhp: user.subscriptionPlan === "premium" ? 299 : 0,
      currency: "PHP",
      startedAt: user.joinedAt,
      nextBillingAt: null,
      endsAt: null,
      renewedAt: null,
    })
    setSubscriptionModalOpen(true)
  }

  const handleCreateUser = async (input: AddUserFormData) => {
    try {
      await createUserMutation.mutateAsync(input)
      toast.success(`User ${input.email} created successfully`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create user"
      toast.error(message)
      throw error
    }
  }

  const handleConfirmDelete = async (userId: string) => {
    try {
      await deleteUserMutation.mutateAsync(userId)
      toast.success("User deleted successfully")
      setSelectedUser(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete user"
      toast.error(message)
      throw error
    }
  }

  const handleSaveSubscription = async (input: {
    userId: string
    plan: "free" | "premium"
    status: "active" | "cancelled" | "suspended"
  }) => {
    try {
      await updateSubscriptionMutation.mutateAsync(input)
      toast.success("Subscription updated successfully")
      setSelectedSubscription(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update subscription"
      toast.error(message)
      throw error
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
            <Users className="text-primary h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage registered users and access roles</p>
          </div>
        </div>
        <Button onClick={() => setAddUserOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View and manage all registered users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10"
            />
          </div>

          {usersQuery.isLoading ? (
            <div className="text-muted-foreground py-6 text-sm">Loading users...</div>
          ) : usersQuery.isError ? (
            <div className="text-destructive py-6 text-sm">
              {usersQuery.error instanceof Error ? usersQuery.error.message : "Failed to load users"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Profiling</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          user.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary"
                        }`}
                      >
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          user.subscriptionPlan === "premium" ? "bg-primary/10 text-primary" : "bg-secondary"
                        }`}
                      >
                        {getPlanDisplayName(user.subscriptionPlan)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          user.hasCompletedProfiling ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {user.hasCompletedProfiling ? "Complete" : "Pending"}
                      </span>
                    </TableCell>
                    <TableCell>{DATE_FORMATTER.format(new Date(user.joinedAt))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManageSubscription(user)}
                        aria-label={`Manage subscription for ${user.name}`}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
                        aria-label={`Delete ${user.name}`}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddUserModal
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onSubmit={handleCreateUser}
        submitting={createUserMutation.isPending}
      />
      <DeleteUserModal
        open={deleteUserOpen}
        onOpenChange={setDeleteUserOpen}
        user={selectedUser}
        deleting={deleteUserMutation.isPending}
        onConfirmDelete={handleConfirmDelete}
      />
      <EditSubscriptionModal
        open={subscriptionModalOpen}
        onOpenChange={setSubscriptionModalOpen}
        subscription={selectedSubscription}
        onSave={handleSaveSubscription}
        saving={updateSubscriptionMutation.isPending}
      />
    </div>
  )
}
