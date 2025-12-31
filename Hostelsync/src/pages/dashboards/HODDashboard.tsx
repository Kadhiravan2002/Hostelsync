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
import { CheckCircle, XCircle, Clock, Users, Building, TrendingUp, AlertCircle, Search } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

export default function HODDashboard() {
  useEffect(() => { document.title = "HOD Dashboard | HostelSync"; }, []);
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [comments, setComments] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get current user's department
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("department_id")
        .eq("user_id", user.data.user.id)
        .single();

      // Fetch hometown requests at HOD stage
      let query = supabase
        .from("outing_requests")
        .select(`
          *,
          profiles!student_id (full_name, student_id, department_id)
        `)
        .eq("outing_type", "hometown")
        .eq("current_stage", "hod")
        .order("created_at", { ascending: false });

      // If HOD has department assigned, filter by department
      if (profile?.department_id) {
        query = query.eq("profiles.department_id", profile.department_id);
      }

      const { data: requests, error } = await query;

      if (error) {
        console.error("Fetch error:", error);
        toast({ title: "Error", description: "Failed to fetch requests", variant: "destructive" });
        return;
      }

      // Fetch complaints (using safe view to protect anonymous submitters)
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
            profiles!student_id (full_name, student_id)
          )
        `)
        .eq("stage", "hod")
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch department students
      let studentQuery = supabase
        .from("profiles")
        .select(`
          *,
          departments (name, code),
          rooms!profiles_room_id_fkey (room_number, floor)
        `)
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (profile?.department_id) {
        studentQuery = studentQuery.eq("department_id", profile.department_id);
      }

      const { data: studentsData, error: studentsError } = await studentQuery;
      
      if (studentsError) {
        console.error("Students query error:", studentsError);
      }
      console.log("Department students fetched:", studentsData?.length, "students for department:", profile?.department_id);

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
      setStats({ total, pending, approved, rejected });
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch requests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId, action) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      let updateData: any = {
        hod_approved_by: user.data.user.id,
        hod_approved_at: new Date().toISOString(),
      };

      if (action === "approve") {
        // Move to Warden stage for final approval
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

      // Add to approval history
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

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return <Badge className={colors[status] || colors.pending}>{status}</Badge>;
  };

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = studentSearch === "" || 
        student.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.phone?.includes(studentSearch);
      
      const matchesYear = yearFilter === "all" || 
        student.year_of_study?.toString() === yearFilter;
      
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && !student.is_blocked) ||
        (statusFilter === "blocked" && student.is_blocked);
      
      return matchesSearch && matchesYear && matchesStatus;
    });
  }, [students, studentSearch, yearFilter, statusFilter]);

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
        subtitle="Department-wise monitoring and approval of hometown outings" 
        userRole="hod" 
      />
      <main className="p-6">
        <div className="max-w-7xl mx-auto">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
          <TabsList>
            <TabsTrigger value="pending">Pending Reviews ({stats.pending})</TabsTrigger>
            <TabsTrigger value="history">My Approval History</TabsTrigger>
            <TabsTrigger value="students">Department Students</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Department Approvals</CardTitle>
                <CardDescription>Hometown requests from your department students waiting for HOD approval</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending requests</p>
                ) : (
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
                      {pendingRequests.map((request) => (
                        <TableRow key={request.id}>
                           <TableCell>
                             <div>
                               <p className="font-medium">{request.profiles?.full_name || "N/A"}</p>
                                <p className="text-sm text-muted-foreground">{request.profiles?.student_id || "N/A"}</p>
                             </div>
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
                                    Approve or reject this hometown outing request from your department
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Approval History</CardTitle>
                <CardDescription>Your recent approval decisions</CardDescription>
              </CardHeader>
              <CardContent>
                {approvalHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No approval history yet</p>
                ) : (
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Department Students</CardTitle>
                <CardDescription>Students from your department ({filteredStudents.length} of {students.length})</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, ID, or phone..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-full md:w-40">
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
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-40">
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
                    {students.length === 0 ? "No students found in your department" : "No students match the current filters"}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.student_id || "N/A"}</TableCell>
                          <TableCell>{student.full_name}</TableCell>
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
        </Tabs>
      </div>
    </main>
    </div>
  );
}
