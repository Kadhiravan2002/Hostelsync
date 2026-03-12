import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Save, Users, Search } from "lucide-react";

interface AttendanceRecord {
  student_id: string;
  full_name: string;
  student_reg: string;
  room_number: string;
  status: "present" | "absent" | null;
  record_id: string | null;
}

interface AttendanceManagementProps {
  hostelType: "boys" | "girls" | null;
}

export default function AttendanceManagement({ hostelType }: AttendanceManagementProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modified, setModified] = useState<Set<string>>(new Set());

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const fetchAttendance = useCallback(async () => {
    if (!hostelType) return;
    setLoading(true);
    try {
      // Fetch students for this hostel
      const { data: students, error: studentsErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, student_id, rooms!profiles_room_id_fkey(room_number)")
        .eq("role", "student")
        .eq("hostel_type", hostelType)
        .order("full_name");

      if (studentsErr) throw studentsErr;

      // Fetch existing attendance for the selected date
      const { data: attendance, error: attErr } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", selectedDate)
        .eq("hostel_type", hostelType);

      if (attErr) throw attErr;

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
    if (!isToday) return; // Only allow edits for today
    setRecords((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, status } : r))
    );
    setModified((prev) => new Set(prev).add(studentId));
  };

  const markAll = (status: "present" | "absent") => {
    if (!isToday) return;
    setRecords((prev) => prev.map((r) => ({ ...r, status })));
    setModified(new Set(records.map((r) => r.student_id)));
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

      // Use upsert with the unique constraint
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
      fetchAttendance(); // Refresh to get record IDs
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = searchQuery
    ? records.filter(
        (r) =>
          r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.student_reg.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.room_number.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : records;

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const unmarkedCount = records.filter((r) => r.status === null).length;

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
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-44"
            />
            {!isToday && (
              <Badge variant="secondary" className="text-xs">View Only</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Total: <strong>{records.length}</strong></span>
          <span className="text-green-600">Present: <strong>{presentCount}</strong></span>
          <span className="text-red-600">Absent: <strong>{absentCount}</strong></span>
          {unmarkedCount > 0 && (
            <span className="text-yellow-600">Unmarked: <strong>{unmarkedCount}</strong></span>
          )}
        </div>

        {/* Bulk actions */}
        {isToday && (
          <div className="flex gap-2">
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
              className="ml-auto"
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
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Register No.</TableHead>
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
