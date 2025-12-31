import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Define app roles consistent with DB
export type AppRole = "admin" | "warden" | "advisor" | "hod" | "student" | "principal";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    // Listener must be sync only
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setRole(null);
        navigate("/auth", { replace: true });
        return;
      }
      // Defer DB calls to avoid deadlocks
      setTimeout(async () => {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        const r = (data?.role as AppRole | undefined) ?? null;
        setRole(r);
        setLoading(false);
        if (r && allowedRoles && !allowedRoles.includes(r)) {
          navigate(`/dashboard/${r}`, { replace: true });
        }
      }, 0);
    });

    // Initial session fetch
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setLoading(false);
        navigate("/auth", { replace: true });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const r = (data?.role as AppRole | undefined) ?? null;
      setRole(r);
      setLoading(false);
      if (r && allowedRoles && !allowedRoles.includes(r)) {
        navigate(`/dashboard/${r}`, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [allowedRoles, navigate]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (!role && allowedRoles?.length) {
    return null;
  }

  return <>{children}</>;
}
