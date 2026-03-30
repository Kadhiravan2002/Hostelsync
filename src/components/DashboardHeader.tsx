import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { LogOut, User, Settings } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  userRole: string;
  hostelType?: "boys" | "girls" | null;
}

export default function DashboardHeader({ title, subtitle, userRole, hostelType }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast({ title: "Logged out successfully", description: "You have been signed out of your account." });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to logout", variant: "destructive" });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getUserInitials = () => userRole.charAt(0).toUpperCase();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{title}</h1>
            {hostelType && (
              <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-primary/10 text-primary capitalize whitespace-nowrap">
                {hostelType} Hostel
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:block text-sm text-muted-foreground">
            Role: <span className="font-medium text-foreground capitalize">{userRole}</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuItem className="font-normal">
                <User className="mr-2 h-4 w-4" />
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none capitalize">{userRole}</p>
                  <p className="text-xs leading-none text-muted-foreground">Dashboard</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
