import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface ManagedUser {
  id: string
  name: string
  email: string
  role: "student" | "admin"
  subscriptionPlan: "free" | "premium"
  subscriptionStatus: "active" | "cancelled" | "suspended"
  hasCompletedProfiling: boolean
  joinedAt: string
}

interface DeleteUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: ManagedUser | null
  deleting?: boolean
  onConfirmDelete: (userId: string) => Promise<void>
}

export function DeleteUserModal({ open, onOpenChange, user, deleting = false, onConfirmDelete }: DeleteUserModalProps) {
  const handleDelete = async () => {
    await onConfirmDelete(user.id)
    onOpenChange(false)
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-destructive/10 flex h-10 w-10 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Delete User Account</DialogTitle>
              <DialogDescription>This action cannot be undone</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Are you sure you want to delete the account for <strong>{user.name}</strong>? This will permanently remove
            all their data, including:
          </p>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            <li>Profile information</li>
            <li>Study materials and files</li>
            <li>Quiz history and scores</li>
            <li>Learning progress data</li>
          </ul>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Account"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
