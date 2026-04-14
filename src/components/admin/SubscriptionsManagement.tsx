import { useMemo, useState } from "react"
import { CreditCard, DollarSign, Search, TrendingUp, Users } from "lucide-react"
import { toast } from "sonner"

import { EditSubscriptionModal, type ManagedSubscription } from "@/components/admin/EditSubscriptionModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  useAdminSubscriptionStats,
  useAdminSubscriptions,
  useUpdateAdminSubscription,
} from "@/hooks/useAdminSubscriptions"
import { getPlanDisplayName } from "@/lib/subscription"

const PHP_CURRENCY_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

export function SubscriptionsManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<ManagedSubscription | null>(null)

  const subscriptionsQuery = useAdminSubscriptions()
  const statsQuery = useAdminSubscriptionStats()
  const updateSubscriptionMutation = useUpdateAdminSubscription()

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const list = subscriptionsQuery.data ?? []
    if (!normalizedQuery) return list

    return list.filter((subscription) => {
      return (
        subscription.userName.toLowerCase().includes(normalizedQuery) ||
        subscription.email.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [subscriptionsQuery.data, searchQuery])

  const handleEditSubscription = (subscription: ManagedSubscription) => {
    setSelectedSubscription(subscription)
    setEditModalOpen(true)
  }

  const handleSaveSubscription = async (input: { userId: string; plan: "free" | "premium"; status: "active" | "cancelled" | "suspended" }) => {
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

  const statsCards = [
    {
      label: "Total Revenue",
      value: PHP_CURRENCY_FORMATTER.format(statsQuery.data?.estimatedMonthlyRevenuePhp ?? 0),
      icon: DollarSign,
    },
    {
      label: "Active Subscriptions",
      value: String(statsQuery.data?.activeSubscriptions ?? 0),
      icon: Users,
    },
    {
      label: "Premium Users",
      value: String(statsQuery.data?.premiumUsers ?? 0),
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
          <CreditCard className="text-primary h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Subscription Management</h1>
          <p className="text-muted-foreground">Monitor and manage user subscriptions</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statsCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {statsQuery.isLoading ? (
                  <p className="text-muted-foreground mt-1 text-xs">Loading...</p>
                ) : statsQuery.isError ? (
                  <p className="text-destructive mt-1 text-xs">Failed to load</p>
                ) : (
                  <p className="text-muted-foreground mt-1 text-xs">Estimated monthly totals</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>View and manage user subscription plans</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by user or email..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10"
            />
          </div>

          {subscriptionsQuery.isLoading ? (
            <div className="text-muted-foreground py-6 text-sm">Loading subscriptions...</div>
          ) : subscriptionsQuery.isError ? (
            <div className="text-destructive py-6 text-sm">
              {subscriptionsQuery.error instanceof Error
                ? subscriptionsQuery.error.message
                : "Failed to load subscriptions"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((subscription) => (
                  <TableRow key={subscription.userId}>
                    <TableCell className="font-medium">{subscription.userName}</TableCell>
                    <TableCell>{subscription.email}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          subscription.plan === "premium" ? "bg-primary/10 text-primary" : "bg-secondary"
                        }`}
                      >
                        {getPlanDisplayName(subscription.plan)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{PHP_CURRENCY_FORMATTER.format(subscription.amountPhp)}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          subscription.status === "active"
                            ? "bg-green-100 text-green-700"
                            : subscription.status === "suspended"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-secondary"
                        }`}
                      >
                        {subscription.status}
                      </span>
                    </TableCell>
                    <TableCell>{DATE_FORMATTER.format(new Date(subscription.startedAt))}</TableCell>
                    <TableCell>
                      {subscription.nextBillingAt ? DATE_FORMATTER.format(new Date(subscription.nextBillingAt)) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleEditSubscription(subscription)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSubscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground py-6 text-center">
                      No subscriptions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditSubscriptionModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        subscription={selectedSubscription}
        onSave={handleSaveSubscription}
        saving={updateSubscriptionMutation.isPending}
      />
    </div>
  )
}
