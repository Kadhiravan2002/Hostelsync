import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ProfileWithDetails {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  student_id?: string;
  year_of_study?: number;
  permanent_address?: string;
  local_address?: string;
  guardian_name?: string;
  guardian_phone?: string;
  photo_url?: string;
  is_approved: boolean;
  departments?: {
    name: string;
  };
  rooms?: {
    room_number: string;
    floor: number;
  };
}

export default function StudentProfile() {
  const [profile, setProfile] = useState<ProfileWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.error("No authenticated user found");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select(`
          *,
          departments(name),
          rooms!profiles_room_id_fkey(room_number, floor)
        `)
        .eq("user_id", user.data.user.id)
        .single();

      if (error) {
        console.error("Profile fetch error:", error);
      } else if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 2MB",
        variant: "destructive"
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG or PNG)",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Upload photo
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.data.user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update profile with photo URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: data.publicUrl })
        .eq('user_id', user.data.user.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Profile photo updated successfully"
      });

      // Refresh profile data
      fetchData();
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading profile...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Profile not found</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-5xl mx-auto">
      <CardContent className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Photo and Basic Info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex flex-col items-center">
              <div className="relative">
                <Avatar className="h-64 w-64 border-4 border-border">
                  <AvatarImage src={profile.photo_url || ""} alt={profile.full_name} />
                  <AvatarFallback className="text-6xl bg-muted">
                    {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-2 right-2">
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full h-12 w-12 p-0 shadow-lg"
                    onClick={() => document.getElementById('photo-upload')?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Passport photo (35×45)</p>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">{profile.full_name}</h2>
              <p className="text-sm text-muted-foreground">
                Student ID • {profile.student_id || "N/A"}
              </p>
              {profile.is_approved ? (
                <Badge className="bg-green-500 text-white hover:bg-green-600">Approved</Badge>
              ) : (
                <Badge variant="secondary">Pending Approval</Badge>
              )}
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
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium">{profile.rooms?.room_number || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Year of Study</p>
                  <p className="font-medium">{profile.year_of_study || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Floor</p>
                  <p className="font-medium">{profile.rooms?.floor || "N/A"}</p>
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
                  <p className="text-sm text-muted-foreground">Local Address</p>
                  <p className="font-medium">{profile.local_address || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile.phone || "N/A"}</p>
                </div>
                <div>
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
  );
}