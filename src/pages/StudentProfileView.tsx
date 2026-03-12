import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

interface StudentProfileData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  student_id: string | null;
  year_of_study: number | null;
  permanent_address: string | null;
  local_address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  photo_url: string | null;
  hostel_type: "boys" | "girls" | null;
  is_approved: boolean;
  is_blocked: boolean;
  key_number: string | null;
  key_issued_at: string | null;
  created_at: string;
  departments?: { name: string; code: string } | null;
  rooms?: { room_number: string; floor: number; capacity: number } | null;
}

export default function StudentProfileView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wardenHostelType, setWardenHostelType] = useState<"boys" | "girls" | null>(null);

  const studentUserId = searchParams.get("id");

  useEffect(() => {
    document.title = "Student Profile | HostelSync";
    fetchProfile();
  }, [studentUserId]);

  const fetchProfile = async () => {
    if (!studentUserId) {
      setError("No student ID provided");
      setLoading(false);
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Get warden's hostel type
      const { data: wardenProfile } = await supabase
        .from("profiles")
        .select("hostel_type")
        .eq("user_id", user.data.user.id)
        .single();

      const hostelType = wardenProfile?.hostel_type as "boys" | "girls" | null;
      setWardenHostelType(hostelType);

      // Fetch the student profile
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select(`
          *,
          departments(name, code),
          rooms!profiles_room_id_fkey(room_number, floor, capacity)
        `)
        .eq("user_id", studentUserId)
        .eq("role", "student")
        .single();

      if (fetchError) {
        setError("Student not found");
        setLoading(false);
        return;
      }

      // Enforce hostel type restriction
      if (hostelType && data.hostel_type !== hostelType) {
        setError("You can only view profiles of students in your assigned hostel");
        setLoading(false);
        return;
      }

      setProfile(data as StudentProfileData);
    } catch (err) {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader title="Student Profile" subtitle="View student details" userRole="warden" hostelType={wardenHostelType} />
        <main className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading profile...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader title="Student Profile" subtitle="View student details" userRole="warden" hostelType={wardenHostelType} />
        <main className="p-6">
          <div className="max-w-5xl mx-auto">
            <Button variant="outline" onClick={() => navigate(-1)} className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-32">
                  <div className="text-muted-foreground">{error || "Profile not found"}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Student Profile" subtitle="Read-only student details" userRole="warden" hostelType={wardenHostelType} />
      <main className="p-6">
        <div className="max-w-5xl mx-auto">
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <Card>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Photo and Basic Info */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="flex flex-col items-center">
                    <Avatar className="h-64 w-64 border-4 border-border">
                      <AvatarImage src={profile.photo_url || ""} alt={profile.full_name} />
                      <AvatarFallback className="text-6xl bg-muted">
                        {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">{profile.full_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      Student ID • {profile.student_id || "N/A"}
                    </p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      {profile.is_approved ? (
                        <Badge className="bg-green-500 text-white hover:bg-green-600">Approved</Badge>
                      ) : (
                        <Badge variant="secondary">Pending Approval</Badge>
                      )}
                      {profile.is_blocked && (
                        <Badge variant="destructive">Blocked</Badge>
                      )}
                      {profile.hostel_type && (
                        <Badge variant="outline" className="capitalize">{profile.hostel_type} Hostel</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Details */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Academic Section */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                      Academic
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Department</p>
                        <p className="font-medium">{profile.departments?.name || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Department Code</p>
                        <p className="font-medium">{profile.departments?.code || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Year of Study</p>
                        <p className="font-medium">{profile.year_of_study ? `Year ${profile.year_of_study}` : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Registered On</p>
                        <p className="font-medium">{new Date(profile.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Room & Key Section */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                      Room & Key
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Room Number</p>
                        <p className="font-medium">{profile.rooms?.room_number || "Unassigned"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Floor</p>
                        <p className="font-medium">{profile.rooms ? `Floor ${profile.rooms.floor}` : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Key Issued</p>
                        <p className="font-medium">{profile.key_number ? `Key ${profile.key_number}` : "No key issued"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Key Issued At</p>
                        <p className="font-medium">{profile.key_issued_at ? new Date(profile.key_issued_at).toLocaleString() : "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Section */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                      Contact
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium break-all">{profile.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{profile.phone || "N/A"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Local Address</p>
                        <p className="font-medium">{profile.local_address || "N/A"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Permanent Address</p>
                        <p className="font-medium">{profile.permanent_address || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Guardian Section */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                      Guardian
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Guardian Name</p>
                        <p className="font-medium">{profile.guardian_name || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Guardian Phone</p>
                        <p className="font-medium">{profile.guardian_phone || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
