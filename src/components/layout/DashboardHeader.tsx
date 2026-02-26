import { BarChart3, LogOut, User, FileQuestion, Calendar, FolderOpen, Bell } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
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

export function DashboardHeader() {
    const navigate = useNavigate()
    const { signOut } = useAuth()
    const [notifications, setNotifications] = useState([
        { id: 1, title: "Quiz Completed", message: "You scored 85% on Physics Quiz", time: "2 hours ago", read: false },
        {
            id: 2,
            title: "New Study Material",
            message: "Calculus notes uploaded successfully",
            time: "5 hours ago",
            read: false,
        },
        { id: 3, title: "Deadline Reminder", message: "Biology exam in 3 days", time: "1 day ago", read: true },
        { id: 4, title: "Achievement Unlocked", message: "5-day study streak!", time: "2 days ago", read: false },
    ])

    const unreadCount = notifications.filter((n) => !n.read).length

    const handleLogout = () => {
        signOut()
        navigate("/login", { replace: true })
    }

    const handleMarkAllRead = () => {
        setNotifications(notifications.map((n) => ({ ...n, read: true })))
    }

    return (
        <header className="border-b bg-card">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <Link to="/dashboard" className="flex items-center gap-2">
                        <img src="/images/educoach-logo.png" alt="EDUCOACH Logo" className="w-10 h-10" />
                        <span className="text-xl font-bold">
                            EDU<span className="text-primary">COACH</span>
                        </span>
                    </Link>

                    <nav className="flex items-center gap-4">
                        <Link to="/dashboard">
                            <Button variant="ghost">Dashboard</Button>
                        </Link>
                        <Link to="/files">
                            <Button variant="ghost" className="gap-2">
                                <FolderOpen className="w-4 h-4" />
                                Files
                            </Button>
                        </Link>
                        <Link to="/quizzes">
                            <Button variant="ghost" className="gap-2">
                                <FileQuestion className="w-4 h-4" />
                                Quizzes
                            </Button>
                        </Link>
                        <Link to="/learning-path">
                            <Button variant="ghost" className="gap-2">
                                <Calendar className="w-4 h-4" />
                                Learning Path
                            </Button>
                        </Link>
                        <Link to="/analytics">
                            <Button variant="ghost" className="gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Analytics
                            </Button>
                        </Link>

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
                            <DropdownMenuContent align="end" className="w-80">
                                <div className="flex items-center justify-between px-2 py-2">
                                    <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                                    <Button variant="ghost" size="sm" className="h-auto p-1 text-xs" onClick={handleMarkAllRead}>
                                        Mark all as read
                                    </Button>
                                </div>
                                <DropdownMenuSeparator />
                                <div className="max-h-[400px] overflow-y-auto">
                                    {notifications.map((notif) => (
                                        <DropdownMenuItem
                                            key={notif.id}
                                            className={`flex flex-col items-start p-3 cursor-pointer ${!notif.read ? "bg-primary/5" : ""}`}
                                        >
                                            <div className="flex items-start justify-between w-full gap-2">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{notif.title}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
                                                </div>
                                                {!notif.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <Avatar>
                                        <AvatarFallback className="bg-primary text-primary-foreground">JD</AvatarFallback>
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
                    </nav>
                </div>
            </div>
        </header>
    )
}
