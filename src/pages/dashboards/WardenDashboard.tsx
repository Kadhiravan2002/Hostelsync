import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import ComplaintAttachments from "@/components/ComplaintAttachments";
import { CheckCircle, XCircle, Clock, Users, MapPin, Calendar, AlertCircle, Eye, Search } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import RoomKeyManagement from "@/components/RoomKeyManagement";
import AttendanceManagement from "@/components/AttendanceManagement";
import MovementStatusBadge from "@/components/MovementStatusBadge";
import StudentTableCell from "@/components/StudentTableCell";
import { useStudentLiveStatus } from "@/hooks/useStudentLiveStatus";

export default function WardenDashboard() {
  const navigate = useNavigate();
  useEffect(() => { document.title = "Warden Dashboard | HostelSync"; }, []);
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [comments, setComments] = useState("");
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [wardenHostelType, setWardenHostelType] = useState<"boys" | "girls" | null>(null);
  const { data: liveStatusData, summary: movementSummary } = useStudentLiveStatus({ hostelType: wardenHostelType, enabled: !!wardenHostelType });

  // Movement filters
  const [movementSearch, setMovementSearch] = useState("");
  const [movementDeptFilter, setMovementDeptFilter] = useState("all");
  const [movementYearFilter, setMovementYearFilter] = useState("all");
  const [movementStatusFilter, setMovementStatusFilter] = useState("all");

  // Students DB filters
  const [studentSearch, setStudentSearch] = useState("");
  const [studentDeptFilter, setStudentDeptFilter] = useState("all");
  const [studentYearFilter, setStudentYearFilter] = useState("all");
  const [studentRoomFilter, setStudentRoomFilter] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("hostel_type")
        .eq("user_id", user.data.user.id)
        .single();

      const wardenHostelType = profile?.hostel_type as "boys" | "girls" | null;
      setWardenHostelType(wardenHostelType);

      if (!wardenHostelType) {
        // No hostel type assigned — show nothing to prevent cross-hostel leak
        setStudents([]);
        setDepartments([]);
        setAllRequests([]);
        setPendingRequests([]);
        setApprovalHistory([]);
        setComplaints([]);
        setStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
        setLoading(false);
        return;
      }

      const studentsQuery = supabase
        .from("profiles")
        .select(`
          *,
          departments(name, code),
          rooms!profiles_room_id_fkey(room_number, floor, capacity)
        `)
        .eq("role", "student")
        .eq("hostel_type", wardenHostelType)
        .order("full_name");

      const { data: studentsData, error: studentsError } = await studentsQuery;
      if (studentsError) console.error("Students query error:", studentsError);

      // Fetch departments
      const { data: departmentsData } = await supabase
        .from("departments")
        .select("*")
        .order("name", { ascending: true });

      const { data: requestsWithProfiles, error: requestsError } = await supabase
        .from("outing_requests")
        .select(`
          *,
          profiles!outing_requests_student_id_fkey (
            user_id, full_name, student_id, department_id, phone,
            guardian_name, guardian_phone, is_approved, local_address,
            permanent_address, room_id, year_of_study, hostel_type
          )
        `)
        .eq("current_stage", "warden")
        .order("created_at", { ascending: false });

      if (requestsError) { console.error("Requests query error:", requestsError); throw requestsError; }
      
      const filteredRequests = (requestsWithProfiles || []).filter(r => r.profiles?.hostel_type === wardenHostelType);

      const { data: history } = await supabase
        .from("approval_history")
        .select(`*, outing_requests (destination, outing_type, from_date, to_date, profiles!student_id (full_name, student_id, hostel_type))`)
        .eq("stage", "warden")
        .order("created_at", { ascending: false })
        .limit(50);

      const filteredHistory = (history || []).filter((h: any) => h.outing_requests?.profiles?.hostel_type === wardenHostelType);

      const complaintsData = await supabase.rpc("get_safe_complaints");
      const filteredComplaints = (complaintsData.data || []).filter((c: any) => c.hostel_type === wardenHostelType);

      const total = filteredRequests.length;
      const pending = filteredRequests.filter(r => r.final_status === "pending").length;
      const approved = filteredRequests.filter(r => r.final_status === "approved").length;
      const rejected = filteredRequests.filter(r => r.final_status === "rejected").length;

      setStudents(studentsData || []);
      setDepartments(departmentsData || []);
      setAllRequests(filteredRequests);
      setPendingRequests(filteredRequests.filter(r => r.final_status === "pending"));
      setApprovalHistory(filteredHistory);
      setComplaints(filteredComplaints);
      setStats({ total, pending, approved, rejected });
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch requests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Build a lookup from students array for enriching movement data
  const studentLookup = useMemo(() => {
    const map: Record<string, any> = {};
    students.forEach((s: any) => { map[s.user_id] = s; });
    return map;
  }, [students]);

  // Enriched movement data with department/year/room
  const enrichedMovementData = useMemo(() => {
    return liveStatusData.map(s => {
      const profile = studentLookup[s.user_id];
      return {
        ...s,
        departmentName: profile?.departments?.name || null,
        yearOfStudy: profile?.year_of_study || null,
        roomNumber: profile?.rooms?.room_number || null,
      };
    });
  }, [liveStatusData, studentLookup]);

  // Filtered movement data
  const filteredMovementData = useMemo(() => {
    return enrichedMovementData.filter(s => {
      const matchesSearch = movementSearch === "" ||
        s.full_name?.toLowerCase().includes(movementSearch.toLowerCase()) ||
        s.student_id?.toLowerCase().includes(movementSearch.toLowerCase());
      const matchesDept = movementDeptFilter === "all" || 
        (studentLookup[s.user_id]?.department_id === movementDeptFilter);
      const matchesYear = movementYearFilter === "all" || 
        s.yearOfStudy?.toString() === movementYearFilter;
      const matchesStatus = movementStatusFilter === "all" || s.movement_status === movementStatusFilter;
      return matchesSearch && matchesDept && matchesYear && matchesStatus;
    });
  }, [enrichedMovementData, movementSearch, movementDeptFilter, movementYearFilter, movementStatusFilter, studentLookup]);

  // Filtered movement summary
  const filteredMovementSummary = useMemo(() => ({
    total: filteredMovementData.length,
    inside: filteredMovementData.filter(s => s.movement_status === "inside").length,
    outside: filteredMovementData.filter(s => s.movement_status === "outside").length,
    overdue: filteredMovementData.filter(s => s.movement_status === "overdue").length,
  }), [filteredMovementData]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s: any) => {
      const matchesSearch = studentSearch === "" ||
        s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.student_id?.toLowerCase().includes(studentSearch.toLowerCase());
      const matchesDept = studentDeptFilter === "all" || s.department_id === studentDeptFilter;
      const matchesYear = studentYearFilter === "all" || s.year_of_study?.toString() === studentYearFilter;
      const matchesRoom = studentRoomFilter === "" || 
        s.rooms?.room_number?.toLowerCase().includes(studentRoomFilter.toLowerCase());
      return matchesSearch && matchesDept && matchesYear && matchesRoom;
    });
  }, [students, studentSearch, studentDeptFilter, studentYearFilter, studentRoomFilter]);

  const handleApproval = async (requestId, action, isLocalOuting = false) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      let updateData: any = {
        warden_approved_by: user.data.user.id,
        warden_approved_at: new Date().toISOString(),
      };

      if (action === "approve") {
        if (isLocalOuting) {
          updateData.final_status = "approved";
        } else {
          updateData.current_stage = "warden";
          updateData.final_status = "approved";
        }
      } else {
        updateData.final_status = "rejected";
        updateData.rejected_by = user.data.user.id;
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = comments;
      }

      const { error } = await supabase
        .from("outing_requests")
        .update(updateData)
        .eq("id", requestId);

      if (error) throw error;

      await supabase.from("approval_history").insert({
        request_id: requestId,
        approver_id: user.data.user.id,
        stage: "warden",
        action: action === "approve" ? "approved" : "rejected",
        comments: comments,
      });

      if (action === "approve") {
        try {
          const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-sms", {
            body: { requestId },
          });
          if (emailError) console.error("Email notification failed:", emailError);
          else if (emailResult?.email_sent) console.log("Email sent to guardian successfully");
          else console.warn("Email not sent:", emailResult?.error);
        } catch (emailErr) {
          console.error("Email function call failed:", emailErr);
        }
      }

      toast({ 
        title: "Success", 
        description: `Request ${action === "approve" ? "approved" : "rejected"} successfully!${action === "approve" ? " Email notification sent to guardian." : ""}` 
      });
      
      setComments("");
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to process request", variant: "destructive" });
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return <Badge className={colors[status] || colors.pending}>{status}</Badge>;
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
        title="Warden Dashboard" 
        subtitle="Approve local outings and final hometown approvals" 
        userRole="warden"
        hostelType={wardenHostelType}
      />
      <main className="p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="w-full">
           <TabsList className="w-full justify-start">
              <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
              <TabsTrigger value="movement">Movement</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="roomkeys">Room Keys</TabsTrigger>
              <TabsTrigger value="all">All Requests</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="complaints">Complaints</TabsTrigger>
           </TabsList>

           <TabsContent value="movement" className="space-y-6">
             {/* Movement Filters */}
             <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
               <div className="relative flex-1 min-w-[200px]">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="Search by name or student ID..."
                   value={movementSearch}
                   onChange={(e) => setMovementSearch(e.target.value)}
                   className="pl-10"
                 />
               </div>
               <Select value={movementDeptFilter} onValueChange={setMovementDeptFilter}>
                 <SelectTrigger className="w-full sm:w-44">
                   <SelectValue placeholder="Department" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Departments</SelectItem>
                   {departments.map((dept: any) => (
                     <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               <Select value={movementYearFilter} onValueChange={setMovementYearFilter}>
                 <SelectTrigger className="w-full sm:w-36">
                   <SelectValue placeholder="Year" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Years</SelectItem>
                   <SelectItem value="1">Year 1</SelectItem>
                   <SelectItem value="2">Year 2</SelectItem>
                   <SelectItem value="3">Year 3</SelectItem>
                   <SelectItem value="4">Year 4</SelectItem>
                 </SelectContent>
               </Select>
               <Select value={movementStatusFilter} onValueChange={setMovementStatusFilter}>
                 <SelectTrigger className="w-full sm:w-40">
                   <SelectValue placeholder="Status" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Status</SelectItem>
                   <SelectItem value="inside">Inside</SelectItem>
                   <SelectItem value="outside">Outside</SelectItem>
                   <SelectItem value="overdue">Overdue</SelectItem>
                 </SelectContent>
               </Select>
             </div>

             {/* Movement Summary Cards - reflect filtered data */}
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
               <Card>
                 <CardContent className="p-4">
                   <p className="text-sm text-muted-foreground">Total Students</p>
                   <p className="text-2xl font-bold">{filteredMovementSummary.total}</p>
                 </CardContent>
               </Card>
               <Card className="border-green-200">
                 <CardContent className="p-4">
                   <p className="text-sm text-muted-foreground">🟢 Inside</p>
                   <p className="text-2xl font-bold text-green-600">{filteredMovementSummary.inside}</p>
                 </CardContent>
               </Card>
               <Card className="border-red-200">
                 <CardContent className="p-4">
                   <p className="text-sm text-muted-foreground">🔴 Outside</p>
                   <p className="text-2xl font-bold text-red-600">{filteredMovementSummary.outside}</p>
                 </CardContent>
               </Card>
               <Card className="border-yellow-200">
                 <CardContent className="p-4">
                   <p className="text-sm text-muted-foreground">⚠️ Overdue</p>
                   <p className="text-2xl font-bold text-yellow-600">{filteredMovementSummary.overdue}</p>
                 </CardContent>
               </Card>
             </div>

             <Card>
               <CardHeader>
                 <CardTitle>Student Movement Status</CardTitle>
                 <CardDescription>Real-time movement tracking for your hostel</CardDescription>
               </CardHeader>
               <CardContent>
                 {filteredMovementData.length === 0 ? (
                   <p className="text-muted-foreground text-center py-8">No students found</p>
                 ) : (
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Student</TableHead>
                         <TableHead>Department</TableHead>
                         <TableHead>Year</TableHead>
                         <TableHead>Room</TableHead>
                         <TableHead>Movement Status</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {filteredMovementData.map((s) => (
                         <TableRow key={s.user_id}>
                           <TableCell>
                             <StudentTableCell
                               fullName={s.full_name}
                               studentId={s.student_id}
                               photoUrl={s.photo_url}
                               hostelType={s.hostel_type}
                               departmentName={s.departmentName}
                               yearOfStudy={s.yearOfStudy}
                               roomNumber={s.roomNumber}
                               showHostelBadge={false}
                             />
                           </TableCell>
                           <TableCell className="text-sm">{s.departmentName || "N/A"}</TableCell>
                           <TableCell className="text-sm">{s.yearOfStudy ? `Year ${s.yearOfStudy}` : "N/A"}</TableCell>
                           <TableCell className="text-sm">{s.roomNumber || "N/A"}</TableCell>
                           <TableCell><MovementStatusBadge status={s.movement_status} /></TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 )}
               </CardContent>
             </Card>
           </TabsContent>

           <TabsContent value="attendance" className="space-y-6">
             <AttendanceManagement hostelType={wardenHostelType} />
           </TabsContent>

          <TabsContent value="pending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Requests waiting for your approval</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending requests</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Profile Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((request) => (
                        <TableRow key={request.id}>
                           <TableCell>
                             <div>
                               <p className="font-medium">{request.profiles?.full_name || "N/A"}</p>
                                <p className="text-sm text-muted-foreground">{request.profiles?.student_id || "N/A"}</p>
                             </div>
                           </TableCell>
                          <TableCell className="capitalize">{request.outing_type}</TableCell>
                          <TableCell>{request.destination}</TableCell>
                          <TableCell>
                            {request.from_date} to {request.to_date}
                            {request.from_time && (
                              <div className="text-sm text-muted-foreground">
                                {request.from_time} - {request.to_time}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {request.profiles?.is_approved ? (
                                <Badge className="bg-green-100 text-green-800">Profile Approved</Badge>
                               ) : (
                                 <div className="space-y-1">
                                   <Badge className="bg-yellow-100 text-yellow-800">Profile Incomplete</Badge>
                                   <Dialog>
                                     <DialogTrigger asChild>
                                       <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                                         View Details
                                       </Button>
                                     </DialogTrigger>
                                     <DialogContent>
                                       <DialogHeader>
                                         <DialogTitle>Student Profile Details</DialogTitle>
                                         <DialogDescription>
                                           Review what information is missing or incomplete
                                         </DialogDescription>
                                       </DialogHeader>
                                       <div className="space-y-3 text-sm">
                                         <div className="grid grid-cols-2 gap-4">
                                           <div><strong>Full Name:</strong> {request.profiles?.full_name || "Not provided"}</div>
                                           <div><strong>Student ID:</strong> {request.profiles?.student_id || "Not provided"}</div>
                                           <div><strong>Phone:</strong> {request.profiles?.phone || "Not provided"}</div>
                                           <div><strong>Guardian Name:</strong> {request.profiles?.guardian_name || "Not provided"}</div>
                                           <div><strong>Guardian Phone:</strong> {request.profiles?.guardian_phone || "Not provided"}</div>
                                           <div><strong>Profile Status:</strong> {request.profiles?.is_approved ? "Approved" : "Pending Approval"}</div>
                                         </div>
                                       </div>
                                     </DialogContent>
                                   </Dialog>
                                 </div>
                               )}
                               {request.profiles?.phone && (
                                 <div className="text-xs text-muted-foreground">
                                   Contact: {request.profiles.phone}
                                 </div>
                               )}
                             </div>
                           </TableCell>
                           <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/student-profile?id=${request.profiles?.user_id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Profile
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      onClick={() => setSelectedRequest(request)}
                                    >
                                      Review
                                    </Button>
                                  </DialogTrigger>
                                 <DialogContent className="max-w-2xl">
                                   <DialogHeader>
                                     <DialogTitle>Review Outing Request</DialogTitle>
                                     <DialogDescription>
                                       Approve or reject this outing request
                                     </DialogDescription>
                                   </DialogHeader>
                                   {selectedRequest && (
                                     <div className="space-y-4">
                                       <div className="grid grid-cols-2 gap-4 text-sm">
                                         <div><strong>Student:</strong> {selectedRequest.profiles?.full_name || "N/A"}</div>
                                         <div><strong>Student ID:</strong> {selectedRequest.profiles?.student_id || "N/A"}</div>
                                         <div><strong>Type:</strong> {selectedRequest.outing_type}</div>
                                         <div><strong>Destination:</strong> {selectedRequest.destination}</div>
                                         <div><strong>Dates:</strong> {selectedRequest.from_date} to {selectedRequest.to_date}</div>
                                         <div><strong>Contact:</strong> {selectedRequest.profiles?.phone || "Not provided"}</div>
                                         {selectedRequest.contact_person && (
                                           <>
                                             <div><strong>Emergency Contact:</strong> {selectedRequest.contact_person}</div>
                                             <div><strong>Emergency Phone:</strong> {selectedRequest.contact_phone}</div>
                                           </>
                                         )}
                                         <div><strong>Guardian:</strong> {selectedRequest.profiles?.guardian_name || "Not provided"}</div>
                                         <div><strong>Guardian Phone:</strong> {selectedRequest.profiles?.guardian_phone || "Not provided"}</div>
                                       </div>
                                       <div>
                                         <strong>Reason:</strong>
                                         <p className="mt-1 text-sm">{selectedRequest.reason}</p>
                                       </div>
                                       <div>
                                         <label className="block text-sm font-medium mb-2">Comments (optional)</label>
                                         <Textarea
                                           value={comments}
                                           onChange={(e) => setComments(e.target.value)}
                                           placeholder="Add comments for your decision..."
                                         />
                                       </div>
                                       <div className="flex gap-2">
                                         <Button
                                           onClick={() => handleApproval(selectedRequest.id, "approve", selectedRequest.outing_type === "local")}
                                           className="flex-1"
                                         >
                                           <CheckCircle className="h-4 w-4 mr-2" />
                                           Approve
                                         </Button>
                                         <Button
                                           onClick={() => handleApproval(selectedRequest.id, "reject")}
                                           variant="destructive"
                                           className="flex-1"
                                         >
                                           <XCircle className="h-4 w-4 mr-2" />
                                           Reject
                                         </Button>
                                       </div>
                                     </div>
                                   )}
                                 </DialogContent>
                               </Dialog>
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

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Students Database
                </CardTitle>
                <CardDescription>Complete overview of all students in the hostel</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Students DB Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or register number..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={studentDeptFilter} onValueChange={setStudentDeptFilter}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dept: any) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={studentYearFilter} onValueChange={setStudentYearFilter}>
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      <SelectItem value="1">Year 1</SelectItem>
                      <SelectItem value="2">Year 2</SelectItem>
                      <SelectItem value="3">Year 3</SelectItem>
                      <SelectItem value="4">Year 4</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Filter by room..."
                    value={studentRoomFilter}
                    onChange={(e) => setStudentRoomFilter(e.target.value)}
                    className="w-full sm:w-36"
                  />
                </div>

                {filteredStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <StudentTableCell
                              fullName={student.full_name}
                              studentId={student.student_id}
                              photoUrl={student.photo_url}
                              hostelType={student.hostel_type}
                              departmentName={student.departments?.name}
                              yearOfStudy={student.year_of_study}
                              roomNumber={student.rooms?.room_number}
                              showHostelBadge={false}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{student.departments?.name || "Unassigned"}</TableCell>
                          <TableCell className="text-sm">{student.year_of_study ? `Year ${student.year_of_study}` : "N/A"}</TableCell>
                          <TableCell className="text-sm">
                            {student.rooms ? `${student.rooms.room_number} (Floor ${student.rooms.floor})` : "Unassigned"}
                          </TableCell>
                          <TableCell className="text-sm">{student.phone || "N/A"}</TableCell>
                          <TableCell>
                            {student.is_approved ? (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/student-profile?id=${student.user_id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Profile
                              </Button>
                              <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => setSelectedStudent(student)}>
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Student Profile</DialogTitle>
                                  <DialogDescription>Complete student information</DialogDescription>
                                </DialogHeader>
                                {selectedStudent && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div className="flex items-center gap-2"><strong>Full Name:</strong> {selectedStudent.full_name}</div>
                                      <div className="flex items-center gap-2"><strong>Student ID:</strong> {selectedStudent.student_id || "N/A"}</div>
                                      <div className="flex items-center gap-2"><strong>Email:</strong> {selectedStudent.email}</div>
                                      <div className="flex items-center gap-2"><strong>Phone:</strong> {selectedStudent.phone || "N/A"}</div>
                                      <div className="flex items-center gap-2"><strong>Department:</strong> {selectedStudent.departments?.name || "Unassigned"}</div>
                                      <div className="flex items-center gap-2"><strong>Year of Study:</strong> {selectedStudent.year_of_study || "N/A"}</div>
                                      <div className="flex items-center gap-2"><strong>Room:</strong> {selectedStudent.rooms?.room_number || "Unassigned"}</div>
                                      <div className="flex items-center gap-2"><strong>Floor:</strong> {selectedStudent.rooms?.floor || "N/A"}</div>
                                      <div className="col-span-2 flex items-start gap-2"><strong>Local Address:</strong> {selectedStudent.local_address || "Not provided"}</div>
                                      <div className="col-span-2 flex items-start gap-2"><strong>Permanent Address:</strong> {selectedStudent.permanent_address || "Not provided"}</div>
                                      <div className="flex items-center gap-2"><strong>Guardian Name:</strong> {selectedStudent.guardian_name || "Not provided"}</div>
                                      <div className="flex items-center gap-2"><strong>Guardian Phone:</strong> {selectedStudent.guardian_phone || "Not provided"}</div>
                                      <div className="flex items-center gap-2">
                                        <strong>Profile Status:</strong>
                                        {selectedStudent.is_approved ? (
                                          <Badge className="bg-green-100 text-green-800">Approved</Badge>
                                        ) : (
                                          <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
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

          <TabsContent value="roomkeys" className="space-y-6">
            <RoomKeyManagement />
          </TabsContent>

          <TabsContent value="all" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Requests</CardTitle>
                <CardDescription>Complete history of outing requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allRequests.map((request) => (
                      <TableRow key={request.id}>
                         <TableCell>
                           <div>
                             <p className="font-medium">{request.profiles?.full_name || "N/A"}</p>
                             <p className="text-sm text-muted-foreground">{request.profiles?.student_id || "N/A"}</p>
                           </div>
                         </TableCell>
                        <TableCell className="capitalize">{request.outing_type}</TableCell>
                        <TableCell>{request.destination}</TableCell>
                        <TableCell>{request.from_date} to {request.to_date}</TableCell>
                        <TableCell>{getStatusBadge(request.final_status)}</TableCell>
                        <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/student-profile?id=${request.profiles?.user_id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Profile
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Approval History</CardTitle>
                <CardDescription>Recent requests you have approved or rejected</CardDescription>
              </CardHeader>
              <CardContent>
                {approvalHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No approval history</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Decision Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvalHistory.map((history) => (
                        <TableRow key={history.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{history.outing_requests?.profiles?.full_name || "N/A"}</p>
                              <p className="text-sm text-muted-foreground">{history.outing_requests?.profiles?.student_id || "N/A"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{history.outing_requests?.outing_type}</TableCell>
                          <TableCell>{history.outing_requests?.destination}</TableCell>
                          <TableCell>{history.outing_requests?.from_date} to {history.outing_requests?.to_date}</TableCell>
                          <TableCell>
                            <Badge className={history.action === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                              {history.action}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(history.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="complaints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Student Complaints
                </CardTitle>
                <CardDescription>Review student complaints and feedback</CardDescription>
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
                              <Badge className={
                                complaint.status === "resolved" ? "bg-green-100 text-green-800" :
                                complaint.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                                "bg-red-100 text-red-800"
                              }>
                                {complaint.status}
                              </Badge>
                              <Badge variant="outline">{complaint.category}</Badge>
                            </div>
                            <p className="text-sm mb-2">{complaint.description}</p>
                            <ComplaintAttachments adminResponse={complaint.admin_response} />
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
        </Tabs>
      </div>
    </main>
    </div>
  );
}
