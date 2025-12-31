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
import { CheckCircle, XCircle, Clock, Users, MapPin, Calendar, AlertCircle } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import RoomKeyManagement from "@/components/RoomKeyManagement";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function WardenDashboard() {
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
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all students
      const { data: studentsData, error: studentsError } = await supabase
        .from("profiles")
        .select(`
          *,
          departments(name, code),
          rooms!profiles_room_id_fkey(room_number, floor, capacity)
        `)
        .eq("role", "student")
        .order("full_name");

      if (studentsError) {
        console.error("Students query error:", studentsError);
      }

      // Fetch requests with profiles using proper join
      const { data: requestsWithProfiles, error: requestsError } = await supabase
        .from("outing_requests")
        .select(`
          *,
          profiles!outing_requests_student_id_fkey (
            user_id,
            full_name,
            student_id,
            department_id,
            phone,
            guardian_name,
            guardian_phone,
            is_approved,
            local_address,
            permanent_address,
            room_id,
            year_of_study
          )
        `)
        .eq("current_stage", "warden")
        .order("created_at", { ascending: false });

      if (requestsError) {
        console.error("Requests query error:", requestsError);
        throw requestsError;
      }
      
      console.log("Requests with profiles:", requestsWithProfiles);

      // Fetch approval history for warden actions
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
        .eq("stage", "warden")
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch complaints (using safe view to protect anonymous submitters)
      const complaintsData = await supabase.rpc("get_safe_complaints");

      // Calculate stats
      const total = requestsWithProfiles?.length || 0;
      const pending = requestsWithProfiles?.filter(r => r.final_status === "pending").length || 0;
      const approved = requestsWithProfiles?.filter(r => r.final_status === "approved").length || 0;
      const rejected = requestsWithProfiles?.filter(r => r.final_status === "rejected").length || 0;

      setStudents(studentsData || []);
      setAllRequests(requestsWithProfiles || []);
      setPendingRequests(requestsWithProfiles?.filter(r => r.final_status === "pending") || []);
      setApprovalHistory(history || []);
      setComplaints(complaintsData.data || []);
      setStats({ total, pending, approved, rejected });
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch requests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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
          // For local outings, warden approval is final
          updateData.final_status = "approved";
        } else {
          // For hometown outings, move to next stage (usually final approval)
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

      // Add to approval history
      await supabase.from("approval_history").insert({
        request_id: requestId,
        approver_id: user.data.user.id,
        stage: "warden",
        action: action === "approve" ? "approved" : "rejected",
        comments: comments,
      });

      toast({ 
        title: "Success", 
        description: `Request ${action === "approve" ? "approved" : "rejected"} successfully!` 
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
      />
      <main className="p-6">
        <div className="max-w-7xl mx-auto">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="pending">Pending Approvals ({stats.pending})</TabsTrigger>
            <TabsTrigger value="students">Students Database</TabsTrigger>
            <TabsTrigger value="roomkeys">Room Keys</TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="history">My Approval History</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
          </TabsList>

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
                                           <div>
                                             <strong>Full Name:</strong> {request.profiles?.full_name || "Not provided"}
                                           </div>
                                           <div>
                                             <strong>Student ID:</strong> {request.profiles?.student_id || "Not provided"}
                                           </div>
                                           <div>
                                             <strong>Phone:</strong> {request.profiles?.phone || "Not provided"}
                                           </div>
                                           <div>
                                             <strong>Guardian Name:</strong> {request.profiles?.guardian_name || "Not provided"}
                                           </div>
                                           <div>
                                             <strong>Guardian Phone:</strong> {request.profiles?.guardian_phone || "Not provided"}
                                           </div>
                                           <div>
                                             <strong>Profile Status:</strong> {request.profiles?.is_approved ? "Approved" : "Pending Approval"}
                                           </div>
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
                                         <div>
                                           <strong>Student:</strong> {selectedRequest.profiles?.full_name || "N/A"}
                                         </div>
                                         <div>
                                           <strong>Student ID:</strong> {selectedRequest.profiles?.student_id || "N/A"}
                                         </div>
                                         <div>
                                           <strong>Type:</strong> {selectedRequest.outing_type}
                                         </div>
                                         <div>
                                           <strong>Destination:</strong> {selectedRequest.destination}
                                         </div>
                                         <div>
                                           <strong>Dates:</strong> {selectedRequest.from_date} to {selectedRequest.to_date}
                                         </div>
                                         <div>
                                           <strong>Contact:</strong> {selectedRequest.profiles?.phone || "Not provided"}
                                         </div>
                                         {selectedRequest.contact_person && (
                                           <>
                                             <div>
                                               <strong>Emergency Contact:</strong> {selectedRequest.contact_person}
                                             </div>
                                             <div>
                                               <strong>Emergency Phone:</strong> {selectedRequest.contact_phone}
                                             </div>
                                           </>
                                         )}
                                         <div>
                                           <strong>Guardian:</strong> {selectedRequest.profiles?.guardian_name || "Not provided"}
                                         </div>
                                         <div>
                                           <strong>Guardian Phone:</strong> {selectedRequest.profiles?.guardian_phone || "Not provided"}
                                         </div>
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
                {students.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={student.photo_url || undefined} alt={student.full_name} />
                                <AvatarFallback>{student.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{student.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{student.student_id || "N/A"}</TableCell>
                          <TableCell>{student.departments?.name || "Unassigned"}</TableCell>
                          <TableCell>{student.year_of_study ? `Year ${student.year_of_study}` : "N/A"}</TableCell>
                          <TableCell>
                            {student.rooms ? `${student.rooms.room_number} (Floor ${student.rooms.floor})` : "Unassigned"}
                          </TableCell>
                          <TableCell>{student.phone || "N/A"}</TableCell>
                          <TableCell>
                            {student.is_approved ? (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
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
                                      <div className="flex items-center gap-2">
                                        <strong>Full Name:</strong> {selectedStudent.full_name}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Student ID:</strong> {selectedStudent.student_id || "N/A"}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Email:</strong> {selectedStudent.email}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Phone:</strong> {selectedStudent.phone || "N/A"}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Department:</strong> {selectedStudent.departments?.name || "Unassigned"}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Year of Study:</strong> {selectedStudent.year_of_study || "N/A"}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Room:</strong> {selectedStudent.rooms?.room_number || "Unassigned"}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Floor:</strong> {selectedStudent.rooms?.floor || "N/A"}
                                      </div>
                                      <div className="col-span-2 flex items-start gap-2">
                                        <strong>Local Address:</strong> {selectedStudent.local_address || "Not provided"}
                                      </div>
                                      <div className="col-span-2 flex items-start gap-2">
                                        <strong>Permanent Address:</strong> {selectedStudent.permanent_address || "Not provided"}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Guardian Name:</strong> {selectedStudent.guardian_name || "Not provided"}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong>Guardian Phone:</strong> {selectedStudent.guardian_phone || "Not provided"}
                                      </div>
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
                          <TableCell>
                            {history.outing_requests?.from_date} to {history.outing_requests?.to_date}
                          </TableCell>
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
