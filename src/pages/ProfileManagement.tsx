import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Users, 
  Eye,
  Edit,
  Check,
  X,
  Search,
  Filter,
  UserPlus,
  Shield,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Home,
  Building
} from "lucide-react";
import { AppRole } from "@/components/ProtectedRoute";

export default function ProfileManagement() {
  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterProfiles();
  }, [profiles, searchTerm, roleFilter, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get current user role first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setCurrentUserRole(currentProfile?.role as AppRole);

      // Fetch profiles based on role permissions
      let profileQuery = supabase.from("profiles").select(`
        *,
        departments(name),
        rooms(room_number, floor)
      `);

      // Apply role-based filtering
      if (currentProfile?.role === "advisor") {
        // Advisors can see students
        profileQuery = profileQuery.eq("role", "student");
      } else if (currentProfile?.role === "hod") {
        // HODs can see students from their department
        const { data: hodProfile } = await supabase
          .from("profiles")
          .select("department_id")
          .eq("user_id", user.id)
          .single();
        
        if (hodProfile?.department_id) {
          profileQuery = profileQuery
            .eq("role", "student")
            .eq("department_id", hodProfile.department_id);
        }
      } else if (currentProfile?.role === "warden") {
        // Wardens can see students
        profileQuery = profileQuery.eq("role", "student");
      } else if (currentProfile?.role === "student") {
        // Students can see their own profile and relevant staff
        profileQuery = profileQuery.or(`user_id.eq.${user.id},role.in.(advisor,hod,warden,principal)`);
      }
      // Admins can see all profiles (no additional filter)

      const [profilesData, departmentsData, roomsData] = await Promise.all([
        profileQuery.order("created_at", { ascending: false }),
        supabase.from("departments").select("*").order("name"),
        supabase.from("rooms").select("*").order("room_number")
      ]);

      setProfiles(profilesData.data || []);
      setDepartments(departmentsData.data || []);
      setRooms(roomsData.data || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filterProfiles = () => {
    let filtered = profiles;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(profile => 
        profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.staff_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter(profile => profile.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "approved") {
        filtered = filtered.filter(profile => profile.is_approved);
      } else if (statusFilter === "pending") {
        filtered = filtered.filter(profile => !profile.is_approved);
      } else if (statusFilter === "blocked") {
        filtered = filtered.filter(profile => profile.is_blocked);
      }
    }

    setFilteredProfiles(filtered);
  };

  const handleApproveProfile = async (profileId) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: true })
        .eq("id", profileId);

      if (error) throw error;

      toast({ title: "Success", description: "Profile approved successfully" });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to approve profile", variant: "destructive" });
    }
  };

  const handleUpdateProfile = async () => {
    try {
      if (!editingProfile) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editingProfile.full_name,
          email: editingProfile.email,
          phone: editingProfile.phone,
          student_id: editingProfile.student_id,
          staff_id: editingProfile.staff_id,
          department_id: editingProfile.department_id,
          room_id: editingProfile.room_id,
          year_of_study: editingProfile.year_of_study,
          local_address: editingProfile.local_address,
          permanent_address: editingProfile.permanent_address,
          guardian_name: editingProfile.guardian_name,
          guardian_phone: editingProfile.guardian_phone,
          role: editingProfile.role,
          is_approved: editingProfile.is_approved,
          is_blocked: editingProfile.is_blocked
        })
        .eq("id", editingProfile.id);

      if (error) throw error;

      toast({ title: "Success", description: "Profile updated successfully" });
      setEditingProfile(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    }
  };

  const canEdit = (profile) => {
    if (currentUserRole === "admin") return true;
    if (currentUserRole === "student") {
      // Students can only edit their own profile
      return profile.user_id === profile.user_id; // This needs the actual current user ID
    }
    if (["advisor", "hod", "warden"].includes(currentUserRole)) {
      // Staff can approve students but limited editing
      return profile.role === "student";
    }
    return false;
  };

  const canApprove = (profile) => {
    if (currentUserRole === "admin") return true;
    if (["advisor", "hod", "warden"].includes(currentUserRole) && profile.role === "student") {
      return !profile.is_approved;
    }
    return false;
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: "bg-purple-100 text-purple-800",
      warden: "bg-blue-100 text-blue-800",
      advisor: "bg-green-100 text-green-800",
      hod: "bg-orange-100 text-orange-800",
      principal: "bg-red-100 text-red-800",
      student: "bg-gray-100 text-gray-800"
    };
    return <Badge className={colors[role] || colors.student}>{role}</Badge>;
  };

  const getStatusBadge = (profile) => {
    if (profile.is_blocked) {
      return <Badge className="bg-red-100 text-red-800">Blocked</Badge>;
    }
    if (profile.is_approved) {
      return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Profile Database</h1>
          <p className="text-muted-foreground">
            Manage user profiles and access control based on your role permissions
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name, email, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="role-filter">Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="advisor">Advisor</SelectItem>
                    <SelectItem value="hod">HOD</SelectItem>
                    <SelectItem value="warden">Warden</SelectItem>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => {
                  setSearchTerm("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                }} variant="outline">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profiles Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Profiles ({filteredProfiles.length})
            </CardTitle>
            <CardDescription>
              {currentUserRole === "admin" && "Full access to all user profiles"}
              {currentUserRole === "student" && "View your profile and relevant staff information"}
              {["advisor", "hod", "warden"].includes(currentUserRole) && "View and manage student profiles within your scope"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredProfiles.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No profiles found matching your criteria</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{profile.full_name}</p>
                          <p className="text-sm text-muted-foreground">{profile.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {profile.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {profile.phone}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {profile.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(profile.role)}</TableCell>
                      <TableCell>{profile.student_id || profile.staff_id || "N/A"}</TableCell>
                      <TableCell>{profile.departments?.name || "Unassigned"}</TableCell>
                      <TableCell>{getStatusBadge(profile)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => setSelectedProfile(profile)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle>Profile Details - {selectedProfile?.full_name}</DialogTitle>
                                <DialogDescription>Complete profile information</DialogDescription>
                              </DialogHeader>
                              {selectedProfile && (
                                <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Personal Information
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div><strong>Name:</strong> {selectedProfile.full_name}</div>
                                        <div><strong>Email:</strong> {selectedProfile.email}</div>
                                        <div><strong>Phone:</strong> {selectedProfile.phone || "N/A"}</div>
                                        <div><strong>Role:</strong> {selectedProfile.role}</div>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <Building className="h-4 w-4" />
                                        Academic/Professional
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div><strong>Student ID:</strong> {selectedProfile.student_id || "N/A"}</div>
                                        <div><strong>Staff ID:</strong> {selectedProfile.staff_id || "N/A"}</div>
                                        <div><strong>Year:</strong> {selectedProfile.year_of_study || "N/A"}</div>
                                        <div><strong>Department:</strong> {selectedProfile.departments?.name || "Unassigned"}</div>
                                        <div><strong>Room:</strong> {selectedProfile.rooms?.room_number ? `${selectedProfile.rooms.room_number} (Floor ${selectedProfile.rooms.floor})` : "Unassigned"}</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        Address Information
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div><strong>Local Address:</strong> {selectedProfile.local_address || "N/A"}</div>
                                        <div><strong>Permanent Address:</strong> {selectedProfile.permanent_address || "N/A"}</div>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        Guardian Information
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div><strong>Guardian Name:</strong> {selectedProfile.guardian_name || "N/A"}</div>
                                        <div><strong>Guardian Phone:</strong> {selectedProfile.guardian_phone || "N/A"}</div>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <Shield className="h-4 w-4" />
                                        Account Status
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div><strong>Approved:</strong> {selectedProfile.is_approved ? "Yes" : "No"}</div>
                                        <div><strong>Blocked:</strong> {selectedProfile.is_blocked ? "Yes" : "No"}</div>
                                        <div><strong>Created:</strong> {new Date(selectedProfile.created_at).toLocaleDateString()}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>

                          {canEdit(profile) && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" onClick={() => setEditingProfile({...profile})}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Profile - {editingProfile?.full_name}</DialogTitle>
                                  <DialogDescription>Update profile information</DialogDescription>
                                </DialogHeader>
                                {editingProfile && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="full_name">Full Name</Label>
                                      <Input
                                        id="full_name"
                                        value={editingProfile.full_name}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, full_name: e.target.value}))}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="email">Email</Label>
                                      <Input
                                        id="email"
                                        value={editingProfile.email}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, email: e.target.value}))}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="phone">Phone</Label>
                                      <Input
                                        id="phone"
                                        value={editingProfile.phone || ""}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, phone: e.target.value}))}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="role">Role</Label>
                                      <Select value={editingProfile.role} onValueChange={(value) => setEditingProfile(prev => ({...prev, role: value}))}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="student">Student</SelectItem>
                                          <SelectItem value="advisor">Advisor</SelectItem>
                                          <SelectItem value="hod">HOD</SelectItem>
                                          <SelectItem value="warden">Warden</SelectItem>
                                          <SelectItem value="principal">Principal</SelectItem>
                                          <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {editingProfile.role === "student" && (
                                      <>
                                        <div>
                                          <Label htmlFor="student_id">Student ID</Label>
                                          <Input
                                            id="student_id"
                                            value={editingProfile.student_id || ""}
                                            onChange={(e) => setEditingProfile(prev => ({...prev, student_id: e.target.value}))}
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="year_of_study">Year of Study</Label>
                                          <Select value={editingProfile.year_of_study?.toString()} onValueChange={(value) => setEditingProfile(prev => ({...prev, year_of_study: parseInt(value)}))}>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="1">1st Year</SelectItem>
                                              <SelectItem value="2">2nd Year</SelectItem>
                                              <SelectItem value="3">3rd Year</SelectItem>
                                              <SelectItem value="4">4th Year</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </>
                                    )}
                                    {editingProfile.role !== "student" && (
                                      <div>
                                        <Label htmlFor="staff_id">Staff ID</Label>
                                        <Input
                                          id="staff_id"
                                          value={editingProfile.staff_id || ""}
                                          onChange={(e) => setEditingProfile(prev => ({...prev, staff_id: e.target.value}))}
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <Label htmlFor="department">Department</Label>
                                      <Select value={editingProfile.department_id || ""} onValueChange={(value) => setEditingProfile(prev => ({...prev, department_id: value}))}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {editingProfile.role === "student" && (
                                      <div>
                                        <Label htmlFor="room">Room</Label>
                                        <Select value={editingProfile.room_id || ""} onValueChange={(value) => setEditingProfile(prev => ({...prev, room_id: value}))}>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select room" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {rooms.map((room) => (
                                              <SelectItem key={room.id} value={room.id}>
                                                {room.room_number} (Floor {room.floor})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                    <div className="col-span-2">
                                      <Label htmlFor="local_address">Local Address</Label>
                                      <Textarea
                                        id="local_address"
                                        value={editingProfile.local_address || ""}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, local_address: e.target.value}))}
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <Label htmlFor="permanent_address">Permanent Address</Label>
                                      <Textarea
                                        id="permanent_address"
                                        value={editingProfile.permanent_address || ""}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, permanent_address: e.target.value}))}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="guardian_name">Guardian Name</Label>
                                      <Input
                                        id="guardian_name"
                                        value={editingProfile.guardian_name || ""}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, guardian_name: e.target.value}))}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="guardian_phone">Guardian Phone</Label>
                                      <Input
                                        id="guardian_phone"
                                        value={editingProfile.guardian_phone || ""}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, guardian_phone: e.target.value}))}
                                      />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id="is_approved"
                                        checked={editingProfile.is_approved}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, is_approved: e.target.checked}))}
                                      />
                                      <Label htmlFor="is_approved">Approved</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id="is_blocked"
                                        checked={editingProfile.is_blocked}
                                        onChange={(e) => setEditingProfile(prev => ({...prev, is_blocked: e.target.checked}))}
                                      />
                                      <Label htmlFor="is_blocked">Blocked</Label>
                                    </div>
                                    <div className="col-span-2 flex gap-2">
                                      <Button onClick={handleUpdateProfile} className="flex-1">
                                        Update Profile
                                      </Button>
                                      <Button variant="outline" onClick={() => setEditingProfile(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          )}

                          {canApprove(profile) && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleApproveProfile(profile.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
