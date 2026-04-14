import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PREMIUM_MONTHLY_PRICE_PHP } from "@/lib/subscription"
import { useMockSubscribePremium, useStudentSubscription } from "@/hooks/useStudentSubscription"

const PHP_CURRENCY_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

export function SubscriptionCheckoutContent() {
  const navigate = useNavigate()
  const [paymentMethod, setPaymentMethod] = useState("gcash")

  const subscriptionQuery = useStudentSubscription()
  const subscribeMutation = useMockSubscribePremium()

  const totalDue = useMemo(() => PHP_CURRENCY_FORMATTER.format(PREMIUM_MONTHLY_PRICE_PHP), [])

  const handleConfirmPayment = async () => {
    try {
      await subscribeMutation.mutateAsync()
      toast.success("Premium unlocked. Mock payment completed successfully.")
      navigate("/subscription")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete mock checkout"
      toast.error(message)
    }
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
          <CardTitle>Unable to load checkout</CardTitle>
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

  if (subscription.hasPremiumEntitlement) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <ShieldCheck className="w-5 h-5" />
            Premium already active
          </CardTitle>
          <CardDescription>
            Your account already has premium-level access. Continue learning with unlimited EduBuddy and full analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/subscription")}>Back to Subscription</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex items-center justify-start">
        <Button variant="ghost" className="gap-2 text-primary" onClick={() => navigate("/subscription")}>
          <ArrowLeft className="w-4 h-4" />
          Back to Subscription
        </Button>
      </div>

      <header className="text-center space-y-3">
        <h1 className="text-4xl font-extrabold tracking-tight">Complete Your Upgrade</h1>
        <p className="text-muted-foreground">Invest in your academic journey with EduCoach Premium.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">1</span>
              <h2 className="text-2xl font-bold">Review Plan</h2>
            </div>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-6 flex items-start justify-between gap-4">
                <div>
                  <Badge className="mb-3">Premium</Badge>
                  <p className="text-lg font-bold">EduCoach Premium</p>
                  <p className="text-sm text-muted-foreground">Unlimited EduBuddy, full analytics, and priority quiz generation</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-extrabold text-primary">{totalDue}</p>
                  <p className="text-xs text-muted-foreground">per month</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">2</span>
              <h2 className="text-2xl font-bold">Payment Method</h2>
            </div>

            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
              <Label htmlFor="pay-gcash" className="block rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className="font-semibold">GCash</span>
                  </div>
                  <RadioGroupItem value="gcash" id="pay-gcash" />
                </div>
              </Label>

              <Label htmlFor="pay-maya" className="block rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <span className="font-semibold">Maya</span>
                  </div>
                  <RadioGroupItem value="maya" id="pay-maya" />
                </div>
              </Label>

              <Label htmlFor="pay-card" className="block rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <span className="font-semibold">Debit / Credit Card</span>
                  </div>
                  <RadioGroupItem value="card" id="pay-card" />
                </div>
              </Label>
            </RadioGroup>
          </section>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 space-y-4">
            <Card className="border-primary/20 shadow-xl shadow-primary/10 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">3</span>
                  Confirmation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Premium Plan</span>
                  <span>{totalDue}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Service Fee</span>
                  <span>{PHP_CURRENCY_FORMATTER.format(0)}</span>
                </div>
                <div className="border-t pt-4 flex items-center justify-between">
                  <span className="font-semibold">Total Due</span>
                  <span className="text-3xl font-extrabold text-primary">{totalDue}</span>
                </div>

                <Button className="w-full h-12 text-base" onClick={handleConfirmPayment} disabled={subscribeMutation.isPending}>
                  {subscribeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Processing mock payment...
                    </>
                  ) : (
                    <>
                      Confirm and Pay
                      <Lock className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground leading-relaxed text-center">
                  This is a mock checkout for testing. No real charges are applied.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-6 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Secure SSL</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Data Protected</span>
            </div>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-4">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 min-h-56 flex items-center justify-center">
          <div className="text-center">
            <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="font-semibold text-lg">EduCoach Premium</p>
            <p className="text-sm text-muted-foreground">Designed to help you study smarter and faster.</p>
          </div>
        </div>

        <div>
          <h4 className="text-xl font-bold mb-4">Why go Premium?</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> 500+ premium study paths and guided plans.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> Ad-free experience across supported devices.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> Priority support for account and learning issues.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
