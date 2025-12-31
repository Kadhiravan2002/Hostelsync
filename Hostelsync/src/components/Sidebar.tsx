import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { 
  Home, 
  Users, 
  FileText, 
  Settings, 
  Building,
  Shield,
  UserCheck,
  Clock,
  AlertCircle,
  MessageSquare,
  Database,
  Calendar
} from "lucide-react";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [userRole, setUserRole] = useState<string | null>(null);
  const collapsed = state === "collapsed";

  useEffect(() => {
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        setUserRole(data?.role || null);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50";

  // Define navigation items based on role
  const getNavigationItems = () => {
    const baseItems = [
      { title: "Dashboard", url: `/dashboard/${userRole}`, icon: Home },
    ];

    switch (userRole) {
      case "admin":
        return [
          ...baseItems,
          { title: "Profile Database", url: "/admin/profiles", icon: Database },
          { title: "User Management", url: "/admin/users", icon: Users },
          { title: "Departments", url: "/admin/departments", icon: Building },
          { title: "Notices", url: "/admin/notices", icon: FileText },
          { title: "Complaints", url: "/admin/complaints", icon: AlertCircle },
          { title: "System Settings", url: "/admin/settings", icon: Settings },
        ];
      
      case "student":
        return [
          ...baseItems,
          { title: "Apply Outing", url: "/student/apply", icon: FileText },
          { title: "My Requests", url: "/student/requests", icon: Clock },
          { title: "Notices", url: "/student/notices", icon: MessageSquare },
          { title: "Profile", url: "/student/profile", icon: UserCheck },
        ];
      
      case "warden":
        return [
          ...baseItems,
          { title: "Pending Approvals", url: "/warden/approvals", icon: Clock },
          { title: "All Requests", url: "/warden/requests", icon: FileText },
          { title: "Student Profiles", url: "/warden/students", icon: Users },
        ];
      
      case "advisor":
        return [
          ...baseItems,
          { title: "Hometown Requests", url: "/advisor/requests", icon: FileText },
          { title: "Student Profiles", url: "/advisor/students", icon: Users },
        ];
      
      case "hod":
        return [
          ...baseItems,
          { title: "Department Requests", url: "/hod/requests", icon: FileText },
          { title: "Department Students", url: "/hod/students", icon: Users },
          { title: "Analytics", url: "/hod/analytics", icon: Calendar },
        ];
      
      case "principal":
        return [
          ...baseItems,
          { title: "System Overview", url: "/principal/overview", icon: Shield },
          { title: "All Requests", url: "/principal/requests", icon: FileText },
          { title: "Analytics", url: "/principal/analytics", icon: Calendar },
        ];
      
      default:
        return baseItems;
    }
  };

  const items = getNavigationItems();
  const isExpanded = items.some((i) => isActive(i.url));

  if (!userRole) {
    return null;
  }

  return (
    <Sidebar
      className={collapsed ? "w-14" : "w-60"}
      collapsible="icon"
    >
      <SidebarTrigger className="m-2 self-end" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Menu
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}