import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Shield, Users, TrendingUp, Calendar, CheckCircle, XCircle, Clock, AlertTriangle, AlertCircle, Search, UserCheck, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function PrincipalDashboard() {
  useEffect(() => { document.title = "Principal Dashboard | HostelSync"; }, []);
  
  const [allRequests, setAllRequests] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({ 
    total: 0, 
    pending: 0, 
    approved: 0, 
    rejected: 0,
    localOutings: 0,
    hometownVisits: 0,
    totalStudents: 0,
    totalStaff: 0
  });
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  
  // Request filters
  const [requestSearch, setRequestSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all outing requests with student details
      const { data: requests } = await supabase
        .from("outing_requests")
        .select(`
          *,
          profiles:student_id (full_name, student_id, department_id, year_of_study)
        `)
        .order("created_at", { ascending: false });

      // Calculate comprehensive stats
      const total = requests?.length || 0;
      const pending = requests?.filter(r => r.final_status === "pending").length || 0;
      const approved = requests?.filter(r => r.final_status === "approved").length || 0;
      const rejected = requests?.filter(r => r.final_status === "rejected").length || 0;
      const localOutings = requests?.filter(r => r.outing_type === "local").length || 0;
      const hometownVisits = requests?.filter(r => r.outing_type === "hometown").length || 0;

      // Get recent requests (last 20)
      const recent = requests?.slice(0, 20) || [];

      // Fetch all students
      const { data: studentsData } = await supabase
        .from("profiles")
        .select(`
          *,
          departments (name, code),
          rooms!profiles_room_id_fkey (room_number, floor)
        `)
        .eq("role", "student")
        .order("full_name", { ascending: true });

      // Fetch all staff members (non-students, non-admins)
      const { data: staffData } = await supabase
        .from("profiles")
        .select(`
          *,
          departments (name, code)
        `)
        .in("role", ["advisor", "hod", "warden"])
        .order("full_name", { ascending: true });

      // Fetch departments
      const { data: departmentsData } = await supabase
        .from("departments")
        .select("*")
        .order("name", { ascending: true });

      // Fetch complaints (using safe view to protect anonymous submitters)
      const complaintsData = await supabase.rpc("get_safe_complaints");

      // Fetch all approval history with request details
      const { data: historyData } = await supabase
        .from("approval_history")
        .select(`
          *,
          outing_requests!inner (
            id,
            destination,
            outing_type,
            from_date,
            to_date,
            student_id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      // Enrich approval history with student and approver details
      const enrichedHistory = await Promise.all(
        (historyData || []).map(async (history) => {
          // Fetch student profile
          const { data: studentProfile } = await supabase
            .from("profiles")
            .select("full_name, student_id")
            .eq("user_id", history.outing_requests?.student_id)
            .single();

          // Fetch approver profile
          const { data: approverProfile } = await supabase
            .from("profiles")
            .select("full_name, role")
            .eq("user_id", history.approver_id)
            .single();

          return {
            ...history,
            student_name: studentProfile?.full_name || "N/A",
            student_roll: studentProfile?.student_id || "N/A",
            approver_name: approverProfile?.full_name || "N/A",
            approver_role: approverProfile?.role || "N/A",
          };
        })
      );

      setAllRequests(requests || []);
      setRecentRequests(recent);
      setStudents(studentsData || []);
      setStaff(staffData || []);
      setDepartments(departmentsData || []);
      setComplaints(complaintsData.data || []);
      setApprovalHistory(enrichedHistory || []);
      setStats({ 
        total, pending, approved, rejected, localOutings, hometownVisits,
        totalStudents: studentsData?.length || 0,
        totalStaff: staffData?.length || 0
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch system overview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Filter requests based on search and filters
  const filteredRequests = useMemo(() => {
    return allRequests.filter((request) => {
      const matchesSearch = requestSearch === "" || 
        request.profiles?.full_name?.toLowerCase().includes(requestSearch.toLowerCase()) ||
        request.profiles?.student_id?.toLowerCase().includes(requestSearch.toLowerCase()) ||
        request.destination?.toLowerCase().includes(requestSearch.toLowerCase());
      
      const matchesType = typeFilter === "all" || request.outing_type === typeFilter;
      const matchesStatus = statusFilter === "all" || request.final_status === statusFilter;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [allRequests, requestSearch, typeFilter, statusFilter]);

  // Recent filtered (same filters applied to recent)
  const filteredRecentRequests = useMemo(() => {
    return recentRequests.filter((request) => {
      const matchesSearch = requestSearch === "" || 
        request.profiles?.full_name?.toLowerCase().includes(requestSearch.toLowerCase()) ||
        request.profiles?.student_id?.toLowerCase().includes(requestSearch.toLowerCase()) ||
        request.destination?.toLowerCase().includes(requestSearch.toLowerCase());
      
      const matchesType = typeFilter === "all" || request.outing_type === typeFilter;
      const matchesStatus = statusFilter === "all" || request.final_status === statusFilter;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [recentRequests, requestSearch, typeFilter, statusFilter]);

  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = studentSearch === "" || 
        student.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.phone?.includes(studentSearch);
      
      const matchesDepartment = departmentFilter === "all" || 
        student.department_id === departmentFilter;
      
      const matchesYear = yearFilter === "all" || 
        student.year_of_study?.toString() === yearFilter;
      
      return matchesSearch && matchesDepartment && matchesYear;
    });
  }, [students, studentSearch, departmentFilter, yearFilter]);

  // Export requests to CSV
  const exportToCSV = () => {
    const headers = ["Student Name", "Student ID", "Type", "Destination", "From Date", "To Date", "Status", "Submitted On"];
    const rows = filteredRequests.map((request) => [
      request.profiles?.full_name || "N/A",
      request.profiles?.student_id || "N/A",
      request.outing_type,
      request.destination,
      request.from_date,
      request.to_date,
      request.final_status,
      new Date(request.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `outing_requests_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast({ title: "Export Complete", description: `${filteredRequests.length} requests exported to CSV` });
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return <Badge className={colors[status] || colors.pending}>{status}</Badge>;
  };

  const getStageBadge = (stage) => {
    const colors = {
      advisor: "bg-blue-100 text-blue-800",
      hod: "bg-purple-100 text-purple-800",
      warden: "bg-orange-100 text-orange-800",
    };
    return <Badge className={colors[stage] || "bg-gray-100 text-gray-800"}>{stage}</Badge>;
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
        title="Principal Dashboard" 
        subtitle="System-wide monitoring and oversight of outing management" 
        userRole="principal" 
      />
      <main className="p-6">
        <div className="max-w-7xl mx-auto">

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-blue-600" />
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
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-indigo-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Local Outings</p>
                  <p className="text-2xl font-bold">{stats.localOutings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Hometown Visits</p>
                  <p className="text-2xl font-bold">{stats.hometownVisits}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="flex-wrap">
            <TabsTrigger value="recent">Recent Activity</TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="history">Approval History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="students">Students ({stats.totalStudents})</TabsTrigger>
            <TabsTrigger value="staff">Staff ({stats.totalStaff})</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Outing Requests</CardTitle>
                <CardDescription>Latest outing requests across all departments</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by student name, ID, or destination..."
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="hometown">Hometown</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredRecentRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No recent requests</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Current Stage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecentRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.profiles?.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {request.profiles?.student_id} • Year {request.profiles?.year_of_study}
                              </p>
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
                          <TableCell>{getStageBadge(request.current_stage)}</TableCell>
                          <TableCell>{getStatusBadge(request.final_status)}</TableCell>
                          <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>All Outing Requests</CardTitle>
                  <CardDescription>Complete system-wide history of outing requests ({filteredRequests.length} total)</CardDescription>
                </div>
                <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by student name, ID, or destination..."
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="hometown">Hometown</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No requests found</p>
                ) : (
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
                      {filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.profiles?.full_name}</p>
                              <p className="text-sm text-muted-foreground">{request.profiles?.student_id}</p>
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System-wide Approval History</CardTitle>
                <CardDescription>Recent approval actions across all departments and stages</CardDescription>
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
                        <TableHead>Stage</TableHead>
                        <TableHead>Approver</TableHead>
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
                              <p className="font-medium">{history.student_name}</p>
                              <p className="text-sm text-muted-foreground">{history.student_roll}</p>
                            </div>
                          </TableCell>
                          <TableCell>{history.outing_requests?.destination || "N/A"}</TableCell>
                          <TableCell>
                            {history.outing_requests?.from_date || "N/A"} to {history.outing_requests?.to_date || "N/A"}
                          </TableCell>
                          <TableCell>{getStageBadge(history.stage)}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{history.approver_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{history.approver_role}</p>
                            </div>
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

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Request Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Local Outings</span>
                      <span className="font-semibold">{stats.localOutings}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Hometown Visits</span>
                      <span className="font-semibold">{stats.hometownVisits}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Approval Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Approval Rate</span>
                      <span className="font-semibold">
                        {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Rejection Rate</span>
                      <span className="font-semibold">
                        {stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Pending Rate</span>
                      <span className="font-semibold">
                        {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Students</span>
                      <span className="font-semibold">{stats.totalStudents}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Staff</span>
                      <span className="font-semibold">{stats.totalStaff}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Departments</span>
                      <span className="font-semibold">{departments.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Students Database</CardTitle>
                <CardDescription>Complete overview of all students in the hostel system</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, ID, or phone..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-[120px]">
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
                </div>

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
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.student_id || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={student.photo_url || undefined} alt={student.full_name} />
                              <AvatarFallback>{student.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span>{student.full_name}</span>
                          </div>
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
                {filteredStudents.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No students found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Staff Directory
                </CardTitle>
                <CardDescription>All advisors, HODs, and wardens in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {staff.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No staff members found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.photo_url || undefined} alt={member.full_name} />
                                <AvatarFallback>{member.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{member.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="capitalize bg-blue-100 text-blue-800">{member.role}</Badge>
                          </TableCell>
                          <TableCell>{member.departments?.name || "N/A"}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>{member.phone || "N/A"}</TableCell>
                          <TableCell>
                            <Badge className={member.is_approved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                              {member.is_approved ? "Approved" : "Pending"}
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
                <CardDescription>System-wide review of student complaints and feedback</CardDescription>
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