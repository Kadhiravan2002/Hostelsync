import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AdminSetup from "./pages/AdminSetup";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import StudentDashboard from "./pages/dashboards/StudentDashboard";
import WardenDashboard from "./pages/dashboards/WardenDashboard";
import AdvisorDashboard from "./pages/dashboards/AdvisorDashboard";
import HODDashboard from "./pages/dashboards/HODDashboard";
import PrincipalDashboard from "./pages/dashboards/PrincipalDashboard";
import ProfileManagement from "./pages/ProfileManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin-setup" element={<AdminSetup />} />

          <Route
            path="/dashboard/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/warden"
            element={
              <ProtectedRoute allowedRoles={["warden"]}>
                <WardenDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/advisor"
            element={
              <ProtectedRoute allowedRoles={["advisor"]}>
                <AdvisorDashboard />
              </ProtectedRoute>
            }
          />
            <Route 
              path="/dashboard/hod" 
              element={
                <ProtectedRoute allowedRoles={["hod"]}>
                  <HODDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/principal" 
              element={
                <ProtectedRoute allowedRoles={["principal"]}>
                  <PrincipalDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/profiles" 
              element={
                <ProtectedRoute allowedRoles={["admin", "advisor", "hod", "warden", "student"]}>
                  <ProfileManagement />
                </ProtectedRoute>
              } 
            />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
