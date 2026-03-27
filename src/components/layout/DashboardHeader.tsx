import { BarChart3, LogOut, User, FileQuestion, Calendar, FolderOpen, Bell, Menu, X, CreditCard } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { hasPremiumEntitlement } from "@/lib/subscription"
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
    useNotifications,
} from "@/hooks/useNotifications"
import type { NotificationRecord } from "@/types/notifications"

export function DashboardHeader() {
    const navigate = useNavigate()
    const { signOut, profile } = useAuth()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // Compute user initials or fallback
    const displayName = profile?.display_name || "User"
    const initials = displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    const { data: notifications = [] } = useNotifications(25)
    const markNotificationRead = useMarkNotificationRead()
    const markAllNotificationsRead = useMarkAllNotificationsRead()
    const unreadCount = notifications.filter((n) => !n.read_at).length
    const hasFullAnalytics = profile
        ? hasPremiumEntitlement(
            profile.subscription_plan,
            profile.subscription_status,
            profile.subscription_trial_ends_at
        )
        : false

    const handleLogout = () => {
        signOut()
        navigate("/login", { replace: true })
    }

    const formatNotificationTime = (iso: string) => {
        const created = new Date(iso).getTime()
        const diffMinutes = Math.max(0, Math.floor((Date.now() - created) / 60000))

        if (diffMinutes < 1) return "Just now"
        if (diffMinutes < 60) return `${diffMinutes}m ago`
        const diffHours = Math.floor(diffMinutes / 60)
        if (diffHours < 24) return `${diffHours}h ago`
        const diffDays = Math.floor(diffHours / 24)
        if (diffDays < 7) return `${diffDays}d ago`
        return new Date(iso).toLocaleDateString()
    }

    const handleMarkAllRead = () => {
        if (unreadCount === 0 || markAllNotificationsRead.isPending) return
        markAllNotificationsRead.mutate()
    }

    const handleNotificationClick = (notification: NotificationRecord) => {
        if (!notification.read_at) {
            markNotificationRead.mutate(notification.id)
        }

        if (notification.cta_route) {
            navigate(notification.cta_route)
        }
    }

    const handlePremiumAnalyticsClick = () => {
        toast.info("Analytics is a Premium feature. Upgrade to unlock full analytics.")
        navigate("/subscription")
    }

    return (
        <header className="border-b bg-card sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-4">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="md:hidden"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </Button>
                        <Link to="/dashboard" className="flex items-center gap-2">
                            <img src="/images/educoach-logo.png" alt="EDUCOACH Logo" className="w-8 h-8 md:w-10 md:h-10" />
                            <span className="text-lg md:text-xl font-bold">
                                EDU<span className="text-primary">COACH</span>
                            </span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
                            <Link to="/dashboard">
                                <Button variant="ghost" className="text-sm">Dashboard</Button>
                            </Link>
                            <Link to="/files">
                                <Button variant="ghost" className="gap-2 text-sm">
                                    <FolderOpen className="w-4 h-4" />
                                    Files
                                </Button>
                            </Link>
                            <Link to="/quizzes">
                                <Button variant="ghost" className="gap-2 text-sm">
                                    <FileQuestion className="w-4 h-4" />
                                    Quizzes
                                </Button>
                            </Link>
                            <Link to="/learning-path">
                                <Button variant="ghost" className="gap-2 text-sm">
                                    <Calendar className="w-4 h-4" />
                                    Path
                                </Button>
                            </Link>
                            {hasFullAnalytics ? (
                                <Link to="/analytics">
                                    <Button variant="ghost" className="gap-2 text-sm">
                                        <BarChart3 className="w-4 h-4" />
                                        Analytics
                                    </Button>
                                </Link>
                            ) : (
                                <Button variant="ghost" className="gap-2 text-sm" onClick={handlePremiumAnalyticsClick}>
                                    <BarChart3 className="w-4 h-4" />
                                    Analytics
                                    <Badge variant="outline" className="ml-1 text-[10px] uppercase">Premium</Badge>
                                </Button>
                            )}
                            <Link to="/subscription">
                                <Button variant="ghost" className="gap-2 text-sm">
                                    <CreditCard className="w-4 h-4" />
                                    Subscription
                                </Button>
                            </Link>
                        </nav>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                                            {unreadCount}
                                        </Badge>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80">
                                <div className="flex items-center justify-between px-2 py-2">
                                    <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-1 text-xs"
                                        onClick={handleMarkAllRead}
                                        disabled={unreadCount === 0 || markAllNotificationsRead.isPending}
                                    >
                                        Mark all as read
                                    </Button>
                                </div>
                                <DropdownMenuSeparator />
                                <div className="max-h-[400px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-3 text-xs text-muted-foreground">You are all caught up.</div>
                                    ) : (
                                        notifications.map((notif) => (
                                            <DropdownMenuItem
                                                key={notif.id}
                                                className={`flex flex-col items-start p-3 cursor-pointer ${!notif.read_at ? "bg-primary/5" : ""}`}
                                                onClick={() => handleNotificationClick(notif)}
                                            >
                                                <div className="flex items-start justify-between w-full gap-2">
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{notif.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{notif.body}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{formatNotificationTime(notif.created_at)}</p>
                                                    </div>
                                                    {!notif.read_at && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                                                </div>
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <Avatar>
                                        <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/profile" className="flex items-center cursor-pointer">
                                        <User className="w-4 h-4 mr-2" />
                                        Profile Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <nav className="md:hidden py-4 border-t mt-4 flex flex-col gap-2">
                        <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                            <Button variant="ghost" className="w-full justify-start text-base">Dashboard</Button>
                        </Link>
                        <Link to="/files" onClick={() => setIsMobileMenuOpen(false)}>
                            <Button variant="ghost" className="w-full justify-start gap-3 text-base">
                                <FolderOpen className="w-5 h-5" />
                                Files
                            </Button>
                        </Link>
                        <Link to="/quizzes" onClick={() => setIsMobileMenuOpen(false)}>
                            <Button variant="ghost" className="w-full justify-start gap-3 text-base">
                                <FileQuestion className="w-5 h-5" />
                                Quizzes
                            </Button>
                        </Link>
                        <Link to="/learning-path" onClick={() => setIsMobileMenuOpen(false)}>
                            <Button variant="ghost" className="w-full justify-start gap-3 text-base">
                                <Calendar className="w-5 h-5" />
                                Learning Path
                            </Button>
                        </Link>
                        {hasFullAnalytics ? (
                            <Link to="/analytics" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" className="w-full justify-start gap-3 text-base">
                                    <BarChart3 className="w-5 h-5" />
                                    Analytics
                                </Button>
                            </Link>
                        ) : (
                            <Button
                                variant="ghost"
                                className="w-full justify-start gap-3 text-base"
                                onClick={() => {
                                    setIsMobileMenuOpen(false)
                                    handlePremiumAnalyticsClick()
                                }}
                            >
                                <BarChart3 className="w-5 h-5" />
                                Analytics
                                <Badge variant="outline" className="ml-auto text-[10px] uppercase">Premium</Badge>
                            </Button>
                        )}
                        <Link to="/subscription" onClick={() => setIsMobileMenuOpen(false)}>
                            <Button variant="ghost" className="w-full justify-start gap-3 text-base">
                                <CreditCard className="w-5 h-5" />
                                Subscription
                            </Button>
                        </Link>
                    </nav>
                )}
            </div>
        </header>
    )
}
