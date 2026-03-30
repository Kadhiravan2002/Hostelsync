import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import ComplaintAttachments from "@/components/ComplaintAttachments";
import { CheckCircle, XCircle, Clock, Users, Building, TrendingUp, AlertCircle, Search, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import StudentTableCell from "@/components/StudentTableCell";
import * as XLSX from "xlsx";

export default function HODDashboard() {
  useEffect(() => { document.title = "HOD Dashboard | HostelSync"; }, []);
  
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [comments, setComments] = useState("");

  // Pending filters
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingYearFilter, setPendingYearFilter] = useState("all");
  const [pendingDeptFilter, setPendingDeptFilter] = useState("all");
  const [pendingHostelFilter, setPendingHostelFilter] = useState("all");

  // Student filters
  const [studentSearch, setStudentSearch] = useState("");
  const [studentYearFilter, setStudentYearFilter] = useState("all");
  const [studentDeptFilter, setStudentDeptFilter] = useState("all");
  const [studentHostelFilter, setStudentHostelFilter] = useState("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");
  const [studentRoomFilter, setStudentRoomFilter] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Fetch ALL hometown requests at HOD stage (no department filter)
      const { data: requests, error } = await supabase
        .from("outing_requests")
        .select(`
          *,
          profiles!student_id (full_name, student_id, department_id, hostel_type, year_of_study, photo_url, room_id, departments (name, code), rooms!profiles_room_id_fkey (room_number))
        `)
        .eq("outing_type", "hometown")
        .eq("current_stage", "hod")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
        toast({ title: "Error", description: "Failed to fetch requests", variant: "destructive" });
        return;
      }

      // Fetch complaints
      const complaintsData = await supabase.rpc("get_safe_complaints");

      // Fetch approval history for HOD actions
      const { data: history } = await supabase
        .from("approval_history")
        .select(`
          *,
          outing_requests (
            destination,
            outing_type,
            from_date,
            to_date,
            final_status,
            profiles!student_id (full_name, student_id)
          )
        `)
        .eq("stage", "hod")
        .eq("approver_id", user.data.user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch ALL students (no department filter)
      const { data: studentsData, error: studentsError } = await supabase
        .from("profiles")
        .select(`
          *,
          departments (name, code),
          rooms!profiles_room_id_fkey (room_number, floor)
        `)
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (studentsError) {
        console.error("Students query error:", studentsError);
      }

      // Fetch departments for filter dropdowns
      const { data: deptData } = await supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

      // Calculate stats
      const total = requests?.length || 0;
      const pending = requests?.filter(r => r.final_status === "pending" && !r.hod_approved_by).length || 0;
      const approved = requests?.filter(r => r.hod_approved_by !== null).length || 0;
      const rejected = requests?.filter(r => r.final_status === "rejected").length || 0;

      setAllRequests(requests || []);
      setPendingRequests(requests?.filter(r => r.final_status === "pending" && !r.hod_approved_by) || []);
      setApprovalHistory(history || []);
      setComplaints(complaintsData.data || []);
      setStudents(studentsData || []);
      setDepartments(deptData || []);
      setStats({ total, pending, approved, rejected });
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch requests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId: string, action: string) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      let updateData: any = {
        hod_approved_by: user.data.user.id,
        hod_approved_at: new Date().toISOString(),
      };

      if (action === "approve") {
        updateData.current_stage = "warden";
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
        stage: "hod",
        action: action === "approve" ? "approved" : "rejected",
        comments: comments,
      });

      toast({ 
        title: "Success", 
        description: `Request ${action === "approve" ? "approved and forwarded to Warden" : "rejected"} successfully!` 
      });
      
      setComments("");
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to process request", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return <Badge className={colors[status] || colors.pending}>{status}</Badge>;
  };

  // Filtered pending requests
  const filteredPending = useMemo(() => {
    return pendingRequests.filter((r) => {
      const p = r.profiles;
      const matchesSearch = pendingSearch === "" ||
        p?.full_name?.toLowerCase().includes(pendingSearch.toLowerCase()) ||
        p?.student_id?.toLowerCase().includes(pendingSearch.toLowerCase());
      const matchesYear = pendingYearFilter === "all" || p?.year_of_study?.toString() === pendingYearFilter;
      const matchesDept = pendingDeptFilter === "all" || p?.department_id === pendingDeptFilter;
      const matchesHostel = pendingHostelFilter === "all" || p?.hostel_type === pendingHostelFilter;
      return matchesSearch && matchesYear && matchesDept && matchesHostel;
    });
  }, [pendingRequests, pendingSearch, pendingYearFilter, pendingDeptFilter, pendingHostelFilter]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = studentSearch === "" || 
        student.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.phone?.includes(studentSearch);
      const matchesYear = studentYearFilter === "all" || student.year_of_study?.toString() === studentYearFilter;
      const matchesDept = studentDeptFilter === "all" || student.department_id === studentDeptFilter;
      const matchesHostel = studentHostelFilter === "all" || student.hostel_type === studentHostelFilter;
      const matchesStatus = studentStatusFilter === "all" ||
        (studentStatusFilter === "active" && !student.is_blocked) ||
        (studentStatusFilter === "blocked" && student.is_blocked);
      const matchesRoom = studentRoomFilter === "" || student.rooms?.room_number?.toLowerCase().includes(studentRoomFilter.toLowerCase());
      return matchesSearch && matchesYear && matchesDept && matchesHostel && matchesStatus && matchesRoom;
    });
  }, [students, studentSearch, studentYearFilter, studentDeptFilter, studentHostelFilter, studentStatusFilter, studentRoomFilter]);

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
        title="HOD Dashboard" 
        subtitle="Monitor and approve hometown outings" 
        userRole="hod" 
      />
      <main className="p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-blue-600" />
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
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Hometown requests waiting for HOD approval ({filteredPending.length} of {pendingRequests.length})</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Pending Filters */}
                <div className="flex flex-col md:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={pendingSearch}
                      onChange={(e) => setPendingSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={pendingYearFilter} onValueChange={setPendingYearFilter}>
                    <SelectTrigger className="w-full md:w-36">
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
                  <Select value={pendingDeptFilter} onValueChange={setPendingDeptFilter}>
                    <SelectTrigger className="w-full md:w-44">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.code || d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={pendingHostelFilter} onValueChange={setPendingHostelFilter}>
                    <SelectTrigger className="w-full md:w-36">
                      <SelectValue placeholder="Hostel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Hostels</SelectItem>
                      <SelectItem value="boys">Boys</SelectItem>
                      <SelectItem value="girls">Girls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredPending.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending requests</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Date Range</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Advisor Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPending.map((request) => (
                          <TableRow key={request.id}>
                             <TableCell>
                               <StudentTableCell
                                 fullName={request.profiles?.full_name || "N/A"}
                                 studentId={request.profiles?.student_id}
                                 photoUrl={request.profiles?.photo_url}
                                 hostelType={request.profiles?.hostel_type}
                                 departmentName={request.profiles?.departments?.name}
                                 yearOfStudy={request.profiles?.year_of_study}
                                 roomNumber={request.profiles?.rooms?.room_number}
                               />
                             </TableCell>
                            <TableCell>{request.destination}</TableCell>
                            <TableCell>
                              {request.from_date} to {request.to_date}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                            <TableCell>
                              {request.advisor_approved_by ? (
                                <Badge className="bg-green-100 text-green-800">Approved</Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    onClick={() => setSelectedRequest(request)}
                                  >
                                    Review
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Review Department Request</DialogTitle>
                                    <DialogDescription>
                                      Approve or reject this hometown outing request
                                    </DialogDescription>
                                  </DialogHeader>
                                  {selectedRequest && (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                         <div>
                                           <strong>Student:</strong> {selectedRequest.profiles?.full_name || "N/A"}
                                         </div>
                                         <div>
                                           <strong>Reg No:</strong> {selectedRequest.profiles?.student_id || "N/A"}
                                         </div>
                                        <div>
                                          <strong>Destination:</strong> {selectedRequest.destination}
                                        </div>
                                        <div>
                                          <strong>Dates:</strong> {selectedRequest.from_date} to {selectedRequest.to_date}
                                        </div>
                                        {selectedRequest.contact_person && (
                                          <>
                                            <div>
                                              <strong>Contact Person:</strong> {selectedRequest.contact_person}
                                            </div>
                                            <div>
                                              <strong>Contact Phone:</strong> {selectedRequest.contact_phone}
                                            </div>
                                          </>
                                        )}
                                        <div>
                                          <strong>Advisor Approved:</strong> {selectedRequest.advisor_approved_at ? "Yes" : "No"}
                                        </div>
                                      </div>
                                      <div>
                                        <strong>Reason for Visit:</strong>
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
                                          onClick={() => handleApproval(selectedRequest.id, "approve")}
                                          className="flex-1"
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Approve & Forward to Warden
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
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Approval History</CardTitle>
                    <CardDescription>Your recent approval decisions</CardDescription>
                  </div>
                  {approvalHistory.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => {
                      const rows = approvalHistory.map((h: any) => ({
                        "Student Name": h.outing_requests?.profiles?.full_name || "N/A",
                        "Register Number": h.outing_requests?.profiles?.student_id || "N/A",
                        "Request Type": h.outing_requests?.outing_type || "N/A",
                        "Destination": h.outing_requests?.destination || "N/A",
                        "Date Range": `${h.outing_requests?.from_date || ""} to ${h.outing_requests?.to_date || ""}`,
                        "Status": h.action,
                        "Comments": h.comments || "-",
                        "Approval Date": new Date(h.created_at).toLocaleDateString(),
                      }));
                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Approval History");
                      XLSX.writeFile(wb, `hod_approval_history_${new Date().toISOString().split("T")[0]}.xlsx`);
                      toast({ title: "Downloaded", description: `${rows.length} records exported` });
                    }}>
                      <Download className="h-4 w-4 mr-1" /> Download Excel
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {approvalHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No approval history yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Date Range</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead>Date</TableHead>
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
                            <TableCell>{history.outing_requests?.destination || "N/A"}</TableCell>
                            <TableCell>
                              {history.outing_requests?.from_date} to {history.outing_requests?.to_date}
                            </TableCell>
                            <TableCell>
                              <Badge className={history.action === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                {history.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{history.comments || "-"}</TableCell>
                            <TableCell>{new Date(history.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Students Database</CardTitle>
                <CardDescription>All students ({filteredStudents.length} of {students.length})</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Student Filters */}
                <div className="flex flex-col md:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, ID, or phone..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={studentYearFilter} onValueChange={setStudentYearFilter}>
                    <SelectTrigger className="w-full md:w-36">
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
                  <Select value={studentDeptFilter} onValueChange={setStudentDeptFilter}>
                    <SelectTrigger className="w-full md:w-44">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.code || d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={studentHostelFilter} onValueChange={setStudentHostelFilter}>
                    <SelectTrigger className="w-full md:w-36">
                      <SelectValue placeholder="Hostel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Hostels</SelectItem>
                      <SelectItem value="boys">Boys</SelectItem>
                      <SelectItem value="girls">Girls</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={studentStatusFilter} onValueChange={setStudentStatusFilter}>
                    <SelectTrigger className="w-full md:w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {students.length === 0 ? "No students found" : "No students match the current filters"}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student) => (
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
                              />
                            </TableCell>
                            <TableCell>{student.departments?.code || "N/A"}</TableCell>
                            <TableCell>Year {student.year_of_study || "N/A"}</TableCell>
                            <TableCell>
                              {student.rooms ? `${student.rooms.room_number} (Floor ${student.rooms.floor})` : "Not Assigned"}
                            </TableCell>
                            <TableCell>{student.phone || "N/A"}</TableCell>
                            <TableCell>
                              <Badge className={student.is_blocked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                                {student.is_blocked ? "Blocked" : "Active"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
