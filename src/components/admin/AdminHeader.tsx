import { CreditCard, LayoutDashboard, LogOut, Users } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"

export function AdminHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const navItems = [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  ]

  const handleLogout = async () => {
    await signOut()
    navigate("/login", { replace: true })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/admin/users" className="flex items-center gap-2">
            <img src="/images/educoach-logo.png" alt="EDUCOACH" className="h-8 w-8" />
            <span className="text-xl font-bold">EDUCOACH Admin</span>
          </Link>

          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href

              return (
                <Link key={item.href} to={item.href}>
                  <Button variant={isActive ? "default" : "ghost"} className="gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2 bg-transparent">
              <LayoutDashboard className="h-4 w-4" />
              Back to App
            </Button>
          </Link>
          <Button variant="ghost" className="gap-2" onClick={() => void handleLogout()}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
