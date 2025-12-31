import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Users, MapPin, Home, AlertCircle } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

export default function AdvisorDashboard() {
  useEffect(() => { document.title = "Advisor Dashboard | HostelSync"; }, []);
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [comments, setComments] = useState("");

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

      // Fetch hometown requests at advisor stage
      let requestsQuery = supabase
        .from("outing_requests")
        .select(`
          *,
          profiles!student_id (full_name, student_id, department_id)
        `)
        .eq("outing_type", "hometown")
        .eq("current_stage", "advisor")
        .order("created_at", { ascending: false });

      // If advisor has department assigned, filter by department
      if (profile?.department_id) {
        requestsQuery = requestsQuery.eq("profiles.department_id", profile.department_id);
      }

      const { data: requests } = await requestsQuery;

      // Fetch complaints (using safe view to protect anonymous submitters)
      const complaintsData = await supabase.rpc("get_safe_complaints");

      // Fetch department students (advisors see only their department students)
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

      // Fetch approval history for Advisor actions
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
        .eq("stage", "advisor")
        .order("created_at", { ascending: false })
        .limit(20);

      // Calculate stats
      const total = requests?.length || 0;
      const pending = requests?.filter(r => r.final_status === "pending").length || 0;
      const approved = requests?.filter(r => r.advisor_approved_by !== null).length || 0;
      const rejected = requests?.filter(r => r.final_status === "rejected").length || 0;

      setAllRequests(requests || []);
      setPendingRequests(requests?.filter(r => r.final_status === "pending" && !r.advisor_approved_by) || []);
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
        advisor_approved_by: user.data.user.id,
        advisor_approved_at: new Date().toISOString(),
      };

      if (action === "approve") {
        // Move to HOD stage for hometown outings
        updateData.current_stage = "hod";
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
        stage: "advisor",
        action: action === "approve" ? "approved" : "rejected",
        comments: comments,
      });

      toast({ 
        title: "Success", 
        description: `Request ${action === "approve" ? "approved and forwarded to HOD" : "rejected"} successfully!` 
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
        title="Advisor Dashboard" 
        subtitle="Review and approve hometown outing requests" 
        userRole="advisor" 
      />
      <main className="p-6">
        <div className="max-w-7xl mx-auto">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Home className="h-8 w-8 text-blue-600" />
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
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="history">My Approval History</TabsTrigger>
            <TabsTrigger value="students">Students Database</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Hometown Requests</CardTitle>
                <CardDescription>Hometown outing requests waiting for your review</CardDescription>
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
                        <TableHead>Contact Info</TableHead>
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
                            {request.contact_person && (
                              <div className="text-sm">
                                <p>{request.contact_person}</p>
                                <p className="text-muted-foreground">{request.contact_phone}</p>
                              </div>
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
                                  <DialogTitle>Review Hometown Request</DialogTitle>
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
                                        Approve & Forward to HOD
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

          <TabsContent value="all" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Hometown Requests</CardTitle>
                <CardDescription>Complete history of hometown outing requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
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
                        <TableCell>{request.destination}</TableCell>
                        <TableCell>
                          {request.from_date} to {request.to_date}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.final_status)}</TableCell>
                        <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
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
                <CardTitle>Students Database</CardTitle>
                <CardDescription>All students in the hostel system</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.student_id || "N/A"}</TableCell>
                        <TableCell>{student.full_name}</TableCell>
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
