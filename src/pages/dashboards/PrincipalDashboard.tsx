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
import ComplaintAttachments from "@/components/ComplaintAttachments";
import { Button } from "@/components/ui/button";
import MovementStatusBadge from "@/components/MovementStatusBadge";
import { useStudentLiveStatus } from "@/hooks/useStudentLiveStatus";

export default function PrincipalDashboard() {
  useEffect(() => { document.title = "Principal Dashboard | HostelSync"; }, []);
  
  const [allRequests, setAllRequests] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
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
  const [hostelFilter, setHostelFilter] = useState("all");
  
  // Request filters
  const [requestSearch, setRequestSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Attendance filters
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendanceHostelFilter, setAttendanceHostelFilter] = useState("all");
  const [movementHostelFilter, setMovementHostelFilter] = useState<"boys" | "girls" | null>(null);

  const { data: liveStatusData, summary: movementSummary } = useStudentLiveStatus({ hostelType: movementHostelFilter });

  useEffect(() => {
    fetchData();
  }, [attendanceDate, attendanceHostelFilter]);

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

      // Fetch attendance overview
      let attendanceQuery = supabase
        .from("attendance")
        .select("*, profiles!attendance_student_id_fkey(full_name, student_id, hostel_type)")
        .eq("date", attendanceDate);
      
      if (attendanceHostelFilter !== "all") {
        attendanceQuery = attendanceQuery.eq("hostel_type", attendanceHostelFilter);
      }
      
      const { data: attData } = await attendanceQuery;

      setAllRequests(requests || []);
      setRecentRequests(recent);
      setStudents(studentsData || []);
      setStaff(staffData || []);
      setDepartments(departmentsData || []);
      setComplaints(complaintsData.data || []);
      setApprovalHistory(enrichedHistory || []);
      setAttendanceData(attData || []);
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
      
      const matchesHostel = hostelFilter === "all" || 
        student.hostel_type === hostelFilter;
      
      return matchesSearch && matchesDepartment && matchesYear && matchesHostel;
    });
  }, [students, studentSearch, departmentFilter, yearFilter, hostelFilter]);

  // Attendance summary stats
  const attendanceSummary = useMemo(() => {
    const boys = attendanceData.filter((r: any) => r.hostel_type === "boys");
    const girls = attendanceData.filter((r: any) => r.hostel_type === "girls");
    
    return {
      total: attendanceData.length,
      totalPresent: attendanceData.filter((r: any) => r.status === "present").length,
      totalAbsent: attendanceData.filter((r: any) => r.status === "absent").length,
      boysPresent: boys.filter((r: any) => r.status === "present").length,
      boysAbsent: boys.filter((r: any) => r.status === "absent").length,
      girlsPresent: girls.filter((r: any) => r.status === "present").length,
      girlsAbsent: girls.filter((r: any) => r.status === "absent").length,
    };
  }, [attendanceData]);

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
            <TabsTrigger value="movement">Movement</TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="history">Approval History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="students">Students ({stats.totalStudents})</TabsTrigger>
            <TabsTrigger value="staff">Staff ({stats.totalStaff})</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
          </TabsList>

          <TabsContent value="movement" className="space-y-6">
            {/* Movement Hostel Filter */}
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-2">Hostel</label>
                <Select
                  value={movementHostelFilter || "all"}
                  onValueChange={(v) => setMovementHostelFilter(v === "all" ? null : v as "boys" | "girls")}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hostels</SelectItem>
                    <SelectItem value="boys">Boys Hostel</SelectItem>
                    <SelectItem value="girls">Girls Hostel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold">{movementSummary.total}</p>
                </CardContent>
              </Card>
              <Card className="border-green-200">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">🟢 Inside</p>
                  <p className="text-2xl font-bold text-green-600">{movementSummary.inside}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">🔴 Outside</p>
                  <p className="text-2xl font-bold text-red-600">{movementSummary.outside}</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-200">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">⚠️ Overdue</p>
                  <p className="text-2xl font-bold text-yellow-600">{movementSummary.overdue}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Student Movement Overview</CardTitle>
                <CardDescription>Real-time computed movement status across hostels</CardDescription>
              </CardHeader>
              <CardContent>
                {liveStatusData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Hostel</TableHead>
                        <TableHead>Movement Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liveStatusData.map((s) => (
                        <TableRow key={s.user_id}>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell>{s.student_id || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={s.hostel_type === "boys" ? "default" : "secondary"}>
                              {s.hostel_type === "boys" ? "Boys" : "Girls"}
                            </Badge>
                          </TableCell>
                          <TableCell><MovementStatusBadge status={s.movement_status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                              <p className="text-xs text-muted-foreground">{request.profiles?.student_id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{request.outing_type}</TableCell>
                          <TableCell>{request.destination}</TableCell>
                          <TableCell className="text-sm">{request.from_date} to {request.to_date}</TableCell>
                          <TableCell>{getStageBadge(request.current_stage)}</TableCell>
                          <TableCell>{getStatusBadge(request.final_status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>All Outing Requests</CardTitle>
                  <CardDescription>System-wide outing request management and tracking</CardDescription>
                </div>
                <Button onClick={exportToCSV} size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>From Date</TableHead>
                          <TableHead>To Date</TableHead>
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
                                <p className="text-xs text-muted-foreground">{request.profiles?.student_id}</p>
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{request.outing_type}</TableCell>
                            <TableCell>{request.destination}</TableCell>
                            <TableCell>{request.from_date}</TableCell>
                            <TableCell>{request.to_date}</TableCell>
                            <TableCell>{getStatusBadge(request.final_status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(request.created_at).toLocaleDateString()}
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

          <TabsContent value="attendance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Attendance Overview
                </CardTitle>
                <CardDescription>Read-only system-wide attendance monitoring</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Date</label>
                    <Input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-44"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Hostel</label>
                    <Select value={attendanceHostelFilter} onValueChange={setAttendanceHostelFilter}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Hostels</SelectItem>
                        <SelectItem value="boys">Boys Hostel</SelectItem>
                        <SelectItem value="girls">Girls Hostel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Present</p>
                      <p className="text-2xl font-bold text-green-600">{attendanceSummary.totalPresent}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Absent</p>
                      <p className="text-2xl font-bold text-red-600">{attendanceSummary.totalAbsent}</p>
                    </CardContent>
                  </Card>

                  {/* Boys Hostel Summary */}
                  <Card className="bg-blue-50">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium">Boys Hostel</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p>Present: <span className="font-bold text-green-600">{attendanceSummary.boysPresent}</span></p>
                        <p>Absent: <span className="font-bold text-red-600">{attendanceSummary.boysAbsent}</span></p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Girls Hostel Summary */}
                  <Card className="bg-pink-50">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium">Girls Hostel</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p>Present: <span className="font-bold text-green-600">{attendanceSummary.girlsPresent}</span></p>
                        <p>Absent: <span className="font-bold text-red-600">{attendanceSummary.girlsAbsent}</span></p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Table */}
                {attendanceData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No attendance records found for this date</div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Register No.</TableHead>
                          <TableHead>Hostel</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceData.map((record: any) => (
                          <TableRow key={`${record.student_id}-${attendanceDate}`}>
                            <TableCell className="font-medium">{record.profiles?.full_name || "N/A"}</TableCell>
                            <TableCell>{record.profiles?.student_id || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={record.hostel_type === "boys" ? "default" : "secondary"}>
                                {record.hostel_type === "boys" ? "Boys" : "Girls"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {record.status === "present" ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <Badge className="bg-green-100 text-green-800">Present</Badge>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <XCircle className="h-4 w-4 text-red-600" />
                                  <Badge className="bg-red-100 text-red-800">Absent</Badge>
                                </div>
                              )}
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
                <CardTitle>System-wide Approval History</CardTitle>
                <CardDescription>Complete audit trail of all approval decisions</CardDescription>
              </CardHeader>
              <CardContent>
                {approvalHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No approval history</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Approver</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvalHistory.map((history) => (
                        <TableRow key={history.id}>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{history.outing_requests?.destination}</p>
                              <p className="text-xs text-muted-foreground">
                                {history.outing_requests?.from_date} to {history.outing_requests?.to_date}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{history.student_name}</p>
                            <p className="text-xs text-muted-foreground">{history.student_roll}</p>
                          </TableCell>
                          <TableCell className="capitalize text-sm">{history.action}</TableCell>
                          <TableCell>{getStageBadge(history.stage)}</TableCell>
                          <TableCell>
                            <p className="text-sm">{history.approver_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{history.approver_role}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(history.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Request Distribution</CardTitle>
                <CardDescription>System-wide analytics and insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Status Breakdown</p>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                        <span className="text-sm">Approved: {stats.approved}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                        <span className="text-sm">Pending: {stats.pending}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500"></div>
                        <span className="text-sm">Rejected: {stats.rejected}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Database</CardTitle>
                <CardDescription>Comprehensive student records and information</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, ID, or phone..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={hostelFilter} onValueChange={setHostelFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Hostel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Hostels</SelectItem>
                      <SelectItem value="boys">Boys</SelectItem>
                      <SelectItem value="girls">Girls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No students found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Hostel</TableHead>
                          <TableHead>Phone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student) => (
                          <TableRow key={student.user_id}>
                            <TableCell className="font-medium">{student.full_name}</TableCell>
                            <TableCell className="text-sm">{student.student_id}</TableCell>
                            <TableCell className="text-sm">{student.departments?.name || "N/A"}</TableCell>
                            <TableCell className="text-sm">{student.year_of_study || "N/A"}</TableCell>
                            <TableCell>
                              {student.hostel_type && (
                                <Badge variant={student.hostel_type === "boys" ? "default" : "secondary"}>
                                  {student.hostel_type === "boys" ? "Boys" : "Girls"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{student.phone || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Staff Directory</CardTitle>
                <CardDescription>System staff members and their roles</CardDescription>
              </CardHeader>
              <CardContent>
                {staff.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No staff members found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staff.map((member) => (
                          <TableRow key={member.user_id}>
                            <TableCell className="font-medium">{member.full_name}</TableCell>
                            <TableCell>
                              <Badge className="capitalize">{member.role}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{member.departments?.name || "N/A"}</TableCell>
                            <TableCell className="text-sm">{member.email}</TableCell>
                            <TableCell className="text-sm">{member.phone || "—"}</TableCell>
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
                <CardTitle>Anonymous Complaints</CardTitle>
                <CardDescription>System-wide complaints and feedback</CardDescription>
              </CardHeader>
              <CardContent>
                {complaints.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No complaints</p>
                ) : (
                  <div className="space-y-4">
                    {complaints.map((complaint: any) => (
                      <div key={complaint.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium">{complaint.title}</h4>
                            <p className="text-sm text-muted-foreground">{complaint.category}</p>
                          </div>
                          <Badge className={complaint.status === "resolved" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                            {complaint.status}
                          </Badge>
                        </div>
                        <p className="text-sm mb-3">{complaint.description}</p>
                        <ComplaintAttachments adminResponse={complaint.admin_response} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        </div>
      </main>
    </div>
  );
}
