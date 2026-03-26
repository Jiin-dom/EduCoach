import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/subscription"

export interface ManagedSubscription {
  userId: string
  userName: string
  email: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  amountPhp: number
  currency: string
  startedAt: string
  nextBillingAt: string | null
  endsAt: string | null
  renewedAt: string | null
}

interface EditSubscriptionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: ManagedSubscription | null
  saving?: boolean
  onSave: (input: { userId: string; plan: SubscriptionPlan; status: SubscriptionStatus }) => Promise<void>
}

export function EditSubscriptionModal({
  open,
  onOpenChange,
  subscription,
  onSave,
  saving = false,
}: EditSubscriptionModalProps) {
  const [plan, setPlan] = useState<ManagedSubscription["plan"]>("free")
  const [status, setStatus] = useState<ManagedSubscription["status"]>("active")

  useEffect(() => {
    if (!subscription) return
    setPlan(subscription.plan)
    setStatus(subscription.status)
  }, [subscription])

  const handleSave = async () => {
    if (!subscription) return
    try {
      await onSave({ userId: subscription.userId, plan, status })
      onOpenChange(false)
    } catch {
      // Keep modal open when save fails so admin can retry.
    }
  }

  const handlePlanChange = (value: string) => {
    if (value === "free" || value === "premium") {
      setPlan(value)
    }
  }

  const handleStatusChange = (value: string) => {
    if (value === "active" || value === "cancelled" || value === "suspended") {
      setStatus(value)
    }
  }

  if (!subscription) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Subscription</DialogTitle>
          <DialogDescription>Update subscription plan and status for {subscription.userName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Subscription Plan</Label>
            <Select value={plan} onValueChange={handlePlanChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="premium">Premium (P299/month)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
