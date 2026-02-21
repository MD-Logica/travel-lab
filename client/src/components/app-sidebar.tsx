import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { Profile, Organization } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Map,
  Users,
  Settings,
  LogOut,
  MapPin,
  Building2,
  BarChart2,
  MessageCircle,
  Bookmark,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { title: "Messages", path: "/dashboard/messages", icon: MessageCircle },
  { title: "Analytics", path: "/dashboard/analytics", icon: BarChart2 },
  { title: "Trips", path: "/trips", icon: Map },
  { title: "Templates", path: "/templates", icon: Bookmark },
  { title: "Clients", path: "/clients", icon: Users },
  { title: "Settings", path: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const { data: org } = useQuery<Organization>({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  const initials = profile?.fullName
    ? profile.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-sm truncate" data-testid="text-sidebar-app-name">Travel Lab</p>
            {org && (
              <p className="text-xs text-muted-foreground truncate" data-testid="text-sidebar-org-name">
                {org.name}
              </p>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-widest text-muted-foreground px-4">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.path === "/dashboard"
                  ? location === "/dashboard"
                  : location === item.path || location.startsWith(item.path + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.path}>
                        <item.icon className="w-4 h-4" strokeWidth={1.5} />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {org && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-widest text-muted-foreground px-4">
              Agency
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="capitalize">{org.plan} Plan</span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={profile?.avatarUrl || user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate" data-testid="text-sidebar-user-name">
              {profile?.fullName || user?.firstName || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {profile?.role || "owner"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
