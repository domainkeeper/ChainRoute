import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { IdentityChip } from "@/components/ui/IdentityChip";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  List, 
  Plus, 
  User, 
  QrCode, 
  LogOut, 
  Menu, 
  X,
  Package
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Shipments", href: "/shipments", icon: List },
  { name: "Scan QR", href: "/scan", icon: QrCode },
  { name: "My Identity", href: "/identity", icon: User },
];

const adminNavigation = [
  { name: "Create Shipment", href: "/shipments/create", icon: Plus },
];

function NavItem({ name, href, Icon }: { name: string; href: string; Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
    >
      <Icon className="h-5 w-5" />
      {name}
    </NavLink>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-64 bg-card border-r transition-transform duration-200 lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <Package className="h-7 w-7 text-primary" />
              <span className="font-bold text-lg">ChainRoute</span>
            </NavLink>
            <button
              className="lg:hidden p-2 rounded-md hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavItem key={item.name} name={item.name} href={item.href} Icon={item.icon} />
            ))}

            {user?.role === "admin" && (
              <>
                <div className="pt-4 pb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </div>
                {adminNavigation.map((item) => (
                  <NavItem key={item.name} name={item.name} href={item.href} Icon={item.icon} />
                ))}
              </>
            )}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t">
            <IdentityChip user={user || undefined} compact />
            <div className="mt-3 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            <button
              className="lg:hidden p-2 rounded-md hover:bg-muted"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {user && (
                <div className="hidden sm:flex items-center gap-3">
                  <RoleBadge role={user.role} size="sm" />
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}