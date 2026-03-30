import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Save, Users, Search } from "lucide-react";

interface AttendanceRecord {
  student_id: string;
  full_name: string;
  student_reg: string;
  room_number: string;
  department_id: string | null;
  department_name: string | null;
  year_of_study: number | null;
  status: "present" | "absent" | null;
  record_id: string | null;
}

interface AttendanceManagementProps {
  hostelType: "boys" | "girls" | null;
}

export default function AttendanceManagement({ hostelType }: AttendanceManagementProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modified, setModified] = useState<Set<string>>(new Set());

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const fetchAttendance = useCallback(async () => {
    if (!hostelType) return;
    setLoading(true);
    try {
      const [{ data: students, error: studentsErr }, { data: depts }, { data: attendance, error: attErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, student_id, department_id, year_of_study, departments(name), rooms!profiles_room_id_fkey(room_number)")
          .eq("role", "student")
          .eq("hostel_type", hostelType)
          .order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
        supabase
          .from("attendance")
          .select("*")
          .eq("date", selectedDate)
          .eq("hostel_type", hostelType),
      ]);

      if (studentsErr) throw studentsErr;
      if (attErr) throw attErr;

      setDepartments(depts || []);

      const attMap = new Map(
        (attendance || []).map((a: any) => [a.student_id, a])
      );

      const merged: AttendanceRecord[] = (students || []).map((s: any) => {
        const existing = attMap.get(s.user_id) as any;
        return {
          student_id: s.user_id,
          full_name: s.full_name,
          student_reg: s.student_id || "",
          room_number: s.rooms?.room_number || "N/A",
          department_id: s.department_id,
          department_name: s.departments?.name || null,
          year_of_study: s.year_of_study,
          status: existing ? existing.status : null,
          record_id: existing ? existing.id : null,
        };
      });

      setRecords(merged);
      setModified(new Set());
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load attendance", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [hostelType, selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const toggleStatus = (studentId: string, status: "present" | "absent") => {
    if (!isToday) return;
    setRecords((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, status } : r))
    );
    setModified((prev) => new Set(prev).add(studentId));
  };

  const markAll = (status: "present" | "absent") => {
    if (!isToday) return;
    // Mark only filtered students
    const filteredIds = new Set(filtered.map(r => r.student_id));
    setRecords((prev) => prev.map((r) => filteredIds.has(r.student_id) ? { ...r, status } : r));
    setModified((prev) => {
      const next = new Set(prev);
      filteredIds.forEach(id => next.add(id));
      return next;
    });
  };

  const saveAttendance = async () => {
    if (!hostelType) return;
    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("Not authenticated");

      const toSave = records.filter(
        (r) => modified.has(r.student_id) && r.status !== null
      );

      if (toSave.length === 0) {
        toast({ title: "Nothing to save", description: "No changes made" });
        setSaving(false);
        return;
      }

      const rows = toSave.map((r) => ({
        student_id: r.student_id,
        hostel_type: hostelType,
        date: selectedDate,
        status: r.status!,
        marked_by: user.data.user!.id,
      }));

      const { error } = await supabase
        .from("attendance")
        .upsert(rows, { onConflict: "student_id,date" });

      if (error) throw error;

      toast({ title: "Saved", description: `Attendance saved for ${toSave.length} students` });
      setModified(new Set());
      fetchAttendance();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch = searchQuery === "" ||
        r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.student_reg.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter === "all" || r.department_id === deptFilter;
      const matchesYear = yearFilter === "all" || r.year_of_study?.toString() === yearFilter;
      const matchesRoom = roomFilter === "" ||
        r.room_number.toLowerCase().includes(roomFilter.toLowerCase());
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "present" && r.status === "present") ||
        (statusFilter === "absent" && r.status === "absent") ||
        (statusFilter === "not_marked" && r.status === null);
      return matchesSearch && matchesDept && matchesYear && matchesRoom && matchesStatus;
    });
  }, [records, searchQuery, deptFilter, yearFilter, roomFilter, statusFilter]);

  const presentCount = filtered.filter((r) => r.status === "present").length;
  const absentCount = filtered.filter((r) => r.status === "absent").length;
  const unmarkedCount = filtered.filter((r) => r.status === null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Attendance Management
        </CardTitle>
        <CardDescription>
          Mark daily attendance for {hostelType === "boys" ? "Boys" : "Girls"} Hostel students
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date + Search row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full sm:w-44"
            />
            {!isToday && (
              <Badge variant="secondary" className="text-xs whitespace-nowrap">View Only</Badge>
            )}
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or reg no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
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
          <div className="w-full sm:w-36">
            <Input
              placeholder="Room number..."
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="not_marked">Not Marked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{filtered.length}</p>
          </div>
          <div className="rounded-md border border-green-200 p-2 text-center">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="text-lg font-bold text-green-600">{presentCount}</p>
          </div>
          <div className="rounded-md border border-red-200 p-2 text-center">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="text-lg font-bold text-red-600">{absentCount}</p>
          </div>
          <div className="rounded-md border border-yellow-200 p-2 text-center">
            <p className="text-xs text-muted-foreground">Unmarked</p>
            <p className="text-lg font-bold text-yellow-600">{unmarkedCount}</p>
          </div>
        </div>

        {/* Bulk actions */}
        {isToday && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => markAll("present")}>
              <CheckCircle className="h-4 w-4 mr-1 text-green-600" /> Mark All Present
            </Button>
            <Button size="sm" variant="outline" onClick={() => markAll("absent")}>
              <XCircle className="h-4 w-4 mr-1 text-red-600" /> Mark All Absent
            </Button>
            <Button
              size="sm"
              onClick={saveAttendance}
              disabled={saving || modified.size === 0}
              className="sm:ml-auto"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : `Save (${modified.size} changes)`}
            </Button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading attendance...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No students found</div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Register No.</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                  {isToday && <TableHead className="text-center">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => (
                  <TableRow key={r.student_id} className={modified.has(r.student_id) ? "bg-accent/30" : ""}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell>{r.student_reg || "—"}</TableCell>
                    <TableCell className="text-sm">{r.department_name || "—"}</TableCell>
                    <TableCell>{r.year_of_study || "—"}</TableCell>
                    <TableCell>{r.room_number}</TableCell>
                    <TableCell>
                      {r.status === "present" && (
                        <Badge className="bg-green-100 text-green-800">Present</Badge>
                      )}
                      {r.status === "absent" && (
                        <Badge className="bg-red-100 text-red-800">Absent</Badge>
                      )}
                      {r.status === null && (
                        <Badge variant="secondary">Not Marked</Badge>
                      )}
                    </TableCell>
                    {isToday && (
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant={r.status === "present" ? "default" : "outline"}
                            className="h-7 px-2"
                            onClick={() => toggleStatus(r.student_id, "present")}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant={r.status === "absent" ? "destructive" : "outline"}
                            className="h-7 px-2"
                            onClick={() => toggleStatus(r.student_id, "absent")}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
