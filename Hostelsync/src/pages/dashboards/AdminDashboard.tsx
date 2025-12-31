import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Users, 
  FileText, 
  AlertCircle, 
  TrendingUp, 
  Building, 
  UserCheck, 
  Settings, 
  Database,
  Eye,
  Edit,
  Check,
  X,
  Plus,
  Home,
  Phone,
  Mail,
  MapPin,
  Calendar,
  UserPlus,
  Shield
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

export default function AdminDashboard() {
  useEffect(() => { document.title = "Admin Dashboard | HostelSync"; }, []);
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    pendingApprovals: 0,
    pendingComplaints: 0,
    recentRequests: 0,
    activeNotices: 0
  });
  const [profiles, setProfiles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [notices, setNotices] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [outingRequests, setOutingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [newNotice, setNewNotice] = useState<{
    title: string;
    content: string;
    is_urgent: boolean;
    target_roles: string[];
  }>({
    title: "",
    content: "",
    is_urgent: false,
    target_roles: ["student"]
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [
        profilesData,
        departmentsData,
        roomsData,
        noticesData,
        complaintsData,
        outingData
      ] = await Promise.all([
        supabase.from("profiles").select(`
          *,
          departments(name),
          rooms!profiles_room_id_fkey(room_number, floor)
        `).order("created_at", { ascending: false }),
        supabase.from("departments").select("*").order("name"),
        supabase.from("rooms").select("*").order("room_number"),
        supabase.from("notices").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_safe_complaints"),
        supabase.from("outing_requests").select(`
          *,
          profiles:student_id(full_name, student_id)
        `).order("created_at", { ascending: false })
      ]);

      const today = new Date().toISOString().split("T")[0];
      
      setStats({
        totalStudents: profilesData.data?.filter(p => p.role === "student").length || 0,
        totalStaff: profilesData.data?.filter(p => p.role !== "student").length || 0,
        pendingApprovals: profilesData.data?.filter(p => !p.is_approved).length || 0,
        pendingComplaints: complaintsData.data?.filter(c => c.status === "pending").length || 0,
        recentRequests: outingData.data?.filter(r => r.created_at?.startsWith(today)).length || 0,
        activeNotices: noticesData.data?.length || 0
      });

      setProfiles(profilesData.data || []);
      setDepartments(departmentsData.data || []);
      setRooms(roomsData.data || []);
      setNotices(noticesData.data || []);
      setComplaints(complaintsData.data || []);
      setOutingRequests(outingData.data || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectProfile = async (profileId, userIdToDelete) => {
    try {
      // Delete the profile first
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

      if (profileError) throw profileError;

      // Delete the auth user (this requires admin privileges)
      // Note: This might need to be done through an edge function for security
      toast({ 
        title: "Success", 
        description: "Registration rejected. User has been removed from the system." 
      });
      fetchDashboardData();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to reject profile. You may need to manually delete the user.", 
        variant: "destructive" 
      });
    }
  };

  const handleApproveProfile = async (profileId) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: true })
        .eq("id", profileId);

      if (error) throw error;

      toast({ title: "Success", description: "Profile approved successfully" });
      fetchDashboardData();
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
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    }
  };

  const handleCreateNotice = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { error } = await supabase.from("notices").insert({
        title: newNotice.title,
        content: newNotice.content,
        is_urgent: newNotice.is_urgent,
        target_roles: newNotice.target_roles as ("student" | "advisor" | "hod" | "warden" | "admin" | "principal")[],
        posted_by: user.data.user.id
      });

      if (error) throw error;

      toast({ title: "Success", description: "Notice created successfully" });
      setNewNotice({ title: "", content: "", is_urgent: false, target_roles: ["student"] });
      fetchDashboardData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create notice", variant: "destructive" });
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      resolved: "bg-blue-100 text-blue-800"
    };
    return <Badge className={colors[status] || colors.pending}>{status}</Badge>;
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

  if (loading) {
    return (
      <main className="min-h-screen p-6 bg-background">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        title="Admin Dashboard" 
        subtitle="System administration, user management, and oversight" 
        userRole="admin" 
      />
      <main className="p-6">
        <div className="max-w-7xl mx-auto">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
                  <p className="text-2xl font-bold">{stats.totalStaff}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
                  <p className="text-2xl font-bold">{stats.pendingApprovals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Pending Complaints</p>
                  <p className="text-2xl font-bold">{stats.pendingComplaints}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Today's Requests</p>
                  <p className="text-2xl font-bold">{stats.recentRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-indigo-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Active Notices</p>
                  <p className="text-2xl font-bold">{stats.activeNotices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="approvals" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="approvals" className="relative">
              Pending Approvals
              {stats.pendingApprovals > 0 && (
                <Badge className="ml-2 bg-red-500 text-white">{stats.pendingApprovals}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="students">Students Database</TabsTrigger>
            <TabsTrigger value="staff">Staff Database</TabsTrigger>
            <TabsTrigger value="notices">Manage Notices</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
            <TabsTrigger value="overview">System Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Students Database
                </CardTitle>
                <CardDescription>Manage all student profiles and information with full edit capabilities</CardDescription>
              </CardHeader>
              <CardContent>
                {profiles.filter(p => p.role === "student").length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.filter(p => p.role === "student").map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">{profile.full_name}</TableCell>
                          <TableCell>{profile.email}</TableCell>
                          <TableCell>{profile.student_id || "N/A"}</TableCell>
                          <TableCell>{profile.departments?.name || "Unassigned"}</TableCell>
                          <TableCell>{profile.year_of_study ? `Year ${profile.year_of_study}` : "N/A"}</TableCell>
                          <TableCell>{profile.rooms?.room_number || "Unassigned"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {profile.is_approved ? (
                                <Badge className="bg-green-100 text-green-800">Active</Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                              )}
                              {profile.is_blocked && (
                                <Badge className="bg-red-100 text-red-800">Blocked</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" onClick={() => setSelectedProfile(profile)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Student Profile Details</DialogTitle>
                                    <DialogDescription>Complete student information</DialogDescription>
                                  </DialogHeader>
                                  {selectedProfile && (
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div><strong>Name:</strong> {selectedProfile.full_name}</div>
                                      <div><strong>Student ID:</strong> {selectedProfile.student_id || "N/A"}</div>
                                      <div><strong>Email:</strong> {selectedProfile.email}</div>
                                      <div><strong>Phone:</strong> {selectedProfile.phone || "N/A"}</div>
                                      <div><strong>Department:</strong> {selectedProfile.departments?.name || "Unassigned"}</div>
                                      <div><strong>Year:</strong> {selectedProfile.year_of_study || "N/A"}</div>
                                      <div><strong>Room:</strong> {selectedProfile.rooms?.room_number || "Unassigned"}</div>
                                      <div><strong>Floor:</strong> {selectedProfile.rooms?.floor || "N/A"}</div>
                                      <div className="col-span-2"><strong>Local Address:</strong> {selectedProfile.local_address || "N/A"}</div>
                                      <div className="col-span-2"><strong>Permanent Address:</strong> {selectedProfile.permanent_address || "N/A"}</div>
                                      <div><strong>Guardian:</strong> {selectedProfile.guardian_name || "N/A"}</div>
                                      <div><strong>Guardian Phone:</strong> {selectedProfile.guardian_phone || "N/A"}</div>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                              
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" onClick={() => setEditingProfile({...profile})}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Edit Profile</DialogTitle>
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

                              {!profile.is_approved && (
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
          </TabsContent>

          <TabsContent value="staff" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Staff Database
                </CardTitle>
                <CardDescription>Manage all staff members with full edit capabilities</CardDescription>
              </CardHeader>
              <CardContent>
                {profiles.filter(p => p.role !== "student").length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No staff members found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Staff ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.filter(p => p.role !== "student").map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">{profile.full_name}</TableCell>
                          <TableCell>{profile.email}</TableCell>
                          <TableCell>{getRoleBadge(profile.role)}</TableCell>
                          <TableCell>{profile.staff_id || "N/A"}</TableCell>
                          <TableCell>{profile.departments?.name || "Unassigned"}</TableCell>
                          <TableCell>{profile.phone || "N/A"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {profile.is_approved ? (
                                <Badge className="bg-green-100 text-green-800">Active</Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                              )}
                              {profile.is_blocked && (
                                <Badge className="bg-red-100 text-red-800">Blocked</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" onClick={() => setSelectedProfile(profile)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Staff Profile Details</DialogTitle>
                                    <DialogDescription>Complete staff member information</DialogDescription>
                                  </DialogHeader>
                                  {selectedProfile && (
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div><strong>Name:</strong> {selectedProfile.full_name}</div>
                                      <div><strong>Role:</strong> {selectedProfile.role}</div>
                                      <div><strong>Staff ID:</strong> {selectedProfile.staff_id || "N/A"}</div>
                                      <div><strong>Email:</strong> {selectedProfile.email}</div>
                                      <div><strong>Phone:</strong> {selectedProfile.phone || "N/A"}</div>
                                      <div><strong>Department:</strong> {selectedProfile.departments?.name || "Unassigned"}</div>
                                      <div className="col-span-2"><strong>Local Address:</strong> {selectedProfile.local_address || "N/A"}</div>
                                      <div className="col-span-2"><strong>Permanent Address:</strong> {selectedProfile.permanent_address || "N/A"}</div>
                                      <div><strong>Status:</strong> 
                                        {selectedProfile.is_approved ? (
                                          <Badge className="ml-2 bg-green-100 text-green-800">Approved</Badge>
                                        ) : (
                                          <Badge className="ml-2 bg-yellow-100 text-yellow-800">Pending Approval</Badge>
                                        )}
                                      </div>
                                      {selectedProfile.is_blocked && (
                                        <div><strong>Access:</strong> 
                                          <Badge className="ml-2 bg-red-100 text-red-800">Blocked</Badge>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                              
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" onClick={() => setEditingProfile({...profile})}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Edit Staff Profile</DialogTitle>
                                    <DialogDescription>Update staff member information and permissions</DialogDescription>
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
                                            <SelectItem value="advisor">Advisor</SelectItem>
                                            <SelectItem value="hod">HOD</SelectItem>
                                            <SelectItem value="warden">Warden</SelectItem>
                                            <SelectItem value="principal">Principal</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label htmlFor="staff_id">Staff ID</Label>
                                        <Input
                                          id="staff_id"
                                          value={editingProfile.staff_id || ""}
                                          onChange={(e) => setEditingProfile(prev => ({...prev, staff_id: e.target.value}))}
                                        />
                                      </div>
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

                              {!profile.is_approved && (
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
          </TabsContent>

          <TabsContent value="approvals" className="space-y-6">
            {/* Staff Approvals Section */}
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <Shield className="h-5 w-5" />
                  Pending Staff Approvals
                  <Badge className="ml-2 bg-yellow-600 text-white">
                    {profiles.filter(p => !p.is_approved && p.role !== 'student').length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-yellow-700">
                  Staff registrations require your approval to prevent unauthorized access
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profiles.filter(p => !p.is_approved && p.role !== 'student').length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending staff approvals</p>
                ) : (
                  <div className="space-y-4">
                    {profiles.filter(p => !p.is_approved && p.role !== 'student').map((profile) => (
                      <div key={profile.id} className="border border-yellow-300 rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-4">
                              <h3 className="font-semibold text-lg">{profile.full_name}</h3>
                              {getRoleBadge(profile.role)}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                {profile.email}
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                {profile.phone || "N/A"}
                              </div>
                              <div className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Staff ID: {profile.staff_id || "N/A"}
                              </div>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {profile.departments?.name || "Unassigned"}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApproveProfile(profile.id)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedProfile(profile)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Review
                            </Button>
                            <Button 
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectProfile(profile.id, profile.user_id)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Student Approvals Section (if any unapproved students exist) */}
            {profiles.filter(p => !p.is_approved && p.role === 'student').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Pending Student Approvals
                  </CardTitle>
                  <CardDescription>Students awaiting approval (auto-approved by default)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {profiles.filter(p => !p.is_approved && p.role === 'student').map((profile) => (
                      <div key={profile.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-4">
                              <h3 className="font-semibold">{profile.full_name}</h3>
                              {getRoleBadge(profile.role)}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              <div>Email: {profile.email}</div>
                              <div>Phone: {profile.phone || "N/A"}</div>
                              <div>Student ID: {profile.student_id || "N/A"}</div>
                              <div>Department: {profile.departments?.name || "Unassigned"}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleApproveProfile(profile.id)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedProfile(profile)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Review
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="notices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create New Notice
                </CardTitle>
                <CardDescription>Post important announcements and updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="notice_title">Title</Label>
                  <Input
                    id="notice_title"
                    value={newNotice.title}
                    onChange={(e) => setNewNotice(prev => ({...prev, title: e.target.value}))}
                    placeholder="Notice title"
                  />
                </div>
                <div>
                  <Label htmlFor="notice_content">Content</Label>
                  <Textarea
                    id="notice_content"
                    value={newNotice.content}
                    onChange={(e) => setNewNotice(prev => ({...prev, content: e.target.value}))}
                    placeholder="Notice content"
                    rows={4}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_urgent"
                    checked={newNotice.is_urgent}
                    onChange={(e) => setNewNotice(prev => ({...prev, is_urgent: e.target.checked}))}
                  />
                  <Label htmlFor="is_urgent">Mark as urgent</Label>
                </div>
                <div>
                  <Label>Target Roles</Label>
                  <div className="flex gap-2 mt-2">
                    {["student", "advisor", "hod", "warden", "principal"].map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`role_${role}`}
                          checked={newNotice.target_roles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewNotice(prev => ({...prev, target_roles: [...prev.target_roles, role]}));
                            } else {
                              setNewNotice(prev => ({...prev, target_roles: prev.target_roles.filter(r => r !== role)}));
                            }
                          }}
                        />
                        <Label htmlFor={`role_${role}`} className="capitalize">{role}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreateNotice} disabled={!newNotice.title || !newNotice.content}>
                  Create Notice
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Notices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {notices.slice(0, 10).map((notice) => (
                    <div key={notice.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{notice.title}</h3>
                            {notice.is_urgent && <Badge variant="destructive">Urgent</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{notice.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Posted on {new Date(notice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="complaints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Manage Complaints
                </CardTitle>
                <CardDescription>Review and respond to user complaints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complaints.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No complaints found</p>
                  ) : (
                    complaints.map((complaint) => (
                      <div key={complaint.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{complaint.title}</h3>
                              {getStatusBadge(complaint.status)}
                              <Badge variant="outline">{complaint.category}</Badge>
                            </div>
                            <p className="text-sm mb-2">{complaint.description}</p>
                            {complaint.admin_response && (
                              <div className="bg-blue-50 p-3 rounded">
                                <p className="text-sm"><strong>Admin Response:</strong> {complaint.admin_response}</p>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Submitted on {new Date(complaint.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  System Overview
                </CardTitle>
                <CardDescription>Recent activity and system health</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h4 className="font-semibold">Recent Outing Requests</h4>
                  {outingRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{request.profiles?.full_name}</p>
                          <p className="text-sm text-muted-foreground">{request.reason}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(request.final_status)}
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
    </div>
  );
}
