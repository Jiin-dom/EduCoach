import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  Clock3,
  Crown,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AI_TUTOR_FREE_DAILY_LIMIT, PREMIUM_MONTHLY_PRICE_PHP } from "@/lib/subscription"
import { useStudentSubscription } from "@/hooks/useStudentSubscription"

const PHP_CURRENCY_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

const DATE_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
})

const FREE_FEATURES: Array<{ label: string; included: boolean }> = [
  { label: `${AI_TUTOR_FREE_DAILY_LIMIT} EduBuddy messages per day`, included: true },
  { label: "Basic dashboard summary", included: true },
  { label: "Standard quiz generation queue", included: true },
  { label: "Advanced analytics dashboard", included: false },
]

const PREMIUM_FEATURES: string[] = [
  "Unlimited EduBuddy messages",
  "Full analytics and trends dashboard",
  "Priority quiz generation queue",
  "Customizable study path recommendations",
]

function getStatusBadgeClass(status: "active" | "cancelled" | "suspended") {
  if (status === "active") return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (status === "suspended") return "bg-amber-100 text-amber-700 border-amber-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

export function SubscriptionContent() {
  const navigate = useNavigate()
  const subscriptionQuery = useStudentSubscription()

  const trialEnded = useMemo(() => {
    const data = subscriptionQuery.data
    if (!data || data.isTrialActive) return false
    if (!data.trialEndsAt) return false
    return data.plan === "free"
  }, [subscriptionQuery.data])

  const handleUpgrade = () => {
    navigate("/subscription/checkout")
  }

  if (subscriptionQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (subscriptionQuery.isError || !subscriptionQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load subscription</CardTitle>
          <CardDescription>
            {subscriptionQuery.error instanceof Error
              ? subscriptionQuery.error.message
              : "Please refresh and try again."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const subscription = subscriptionQuery.data
  const isPremium = subscription.hasPremiumEntitlement
  const isActualPremiumPlan = subscription.plan === "premium" && subscription.status === "active"

  return (
    <div className="space-y-10">
      <header className="text-center space-y-4">
        <p className="text-xs font-semibold tracking-[0.24em] uppercase text-muted-foreground">Membership Atelier</p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          Elevate your <span className="text-primary">learning experience</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Choose the perfect path for your academic journey. Free covers the essentials, while Premium unlocks full analytics and unlimited AI coaching.
        </p>
      </header>

      {(subscription.isTrialActive || trialEnded) && (
        <Card className={subscription.isTrialActive ? "border-primary/30 bg-primary/5" : "border-amber-300 bg-amber-50/70"}>
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {subscription.isTrialActive ? (
              <>
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Sparkles className="w-4 h-4" />
                  Full Premium Trial Active
                </div>
                <p className="text-sm text-muted-foreground">
                  {subscription.trialDaysLeft} day{subscription.trialDaysLeft === 1 ? "" : "s"} left. Trial ends on{" "}
                  {subscription.trialEndsAt ? DATE_FORMATTER.format(new Date(subscription.trialEndsAt)) : "—"}.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-amber-700 font-semibold">
                  <Clock3 className="w-4 h-4" />
                  Trial Ended
                </div>
                <p className="text-sm text-amber-700/90">
                  You are now on Free. Upgrade anytime to unlock unlimited EduBuddy and full analytics.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-primary/15 bg-primary/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wallet className="w-5 h-5 text-primary" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-semibold capitalize">{subscription.plan}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={getStatusBadgeClass(subscription.status)}>
                  {subscription.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Started</span>
                <span>{DATE_FORMATTER.format(new Date(subscription.startedAt))}</span>
              </div>

              <div className="rounded-lg border-l-4 border-primary bg-white/70 p-3 mt-4">
                <p className="text-sm text-foreground/90">
                  {isPremium
                    ? "You already have premium-level access. Keep building momentum with full AI assistance and analytics."
                    : "You are currently using core study tools. Upgrade to unlock unlimited EduBuddy and faster quiz generation."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {isActualPremiumPlan ? "Mock billing attached (Premium active)." : "No payment method attached."}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-2xl">Free</CardTitle>
              <CardDescription>Essential tools for students starting their journey.</CardDescription>
              <div className="pt-2">
                <span className="text-4xl font-extrabold">{PHP_CURRENCY_FORMATTER.format(0)}</span>
                <span className="text-muted-foreground"> / month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {FREE_FEATURES.map((feature) => (
                <div key={feature.label} className="flex items-start gap-2 text-sm">
                  {feature.included ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                  ) : (
                    <XCircle className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  )}
                  <span className={feature.included ? "" : "line-through text-muted-foreground"}>{feature.label}</span>
                </div>
              ))}

              <Button className="w-full mt-4" variant="secondary" disabled={subscription.plan === "free"}>
                {subscription.plan === "free" ? "Current Plan" : "Switch to Free"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary shadow-xl shadow-primary/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold tracking-widest px-3 py-1 rounded-bl-lg">
              POPULAR CHOICE
            </div>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                Premium
                <Crown className="w-5 h-5 text-primary" />
              </CardTitle>
              <CardDescription>Full access to AI-powered coaching and advanced analytics.</CardDescription>
              <div className="pt-2">
                <span className="text-4xl font-extrabold text-primary">{PHP_CURRENCY_FORMATTER.format(PREMIUM_MONTHLY_PRICE_PHP)}</span>
                <span className="text-muted-foreground"> / month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {PREMIUM_FEATURES.map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}

              {isActualPremiumPlan ? (
                <Button className="w-full mt-4" disabled>
                  Premium Active
                </Button>
              ) : subscription.isTrialActive ? (
                <Button className="w-full mt-4" disabled>
                  Trial Active
                </Button>
              ) : (
                <Button className="w-full mt-4" onClick={handleUpgrade}>
                  Upgrade to Premium
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="text-center rounded-xl border bg-card p-5">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-semibold mb-1">Secure Payments</h4>
          <p className="text-sm text-muted-foreground">Industry-standard encryption for all transactions.</p>
        </div>
        <div className="text-center rounded-xl border bg-card p-5">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Clock3 className="w-5 h-5" />
          </div>
          <h4 className="font-semibold mb-1">Cancel Anytime</h4>
          <p className="text-sm text-muted-foreground">No long-term lock-in. Manage your subscription anytime.</p>
        </div>
        <div className="text-center rounded-xl border bg-card p-5">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-semibold mb-1">Priority Support</h4>
          <p className="text-sm text-muted-foreground">Premium users get faster support for study and account issues.</p>
        </div>
      </section>
    </div>
  )
}
