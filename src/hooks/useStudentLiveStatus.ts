import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StudentLiveStatus {
  user_id: string;
  full_name: string;
  student_id: string | null;
  hostel_type: string | null;
  department_id: string | null;
  room_id: string | null;
  photo_url: string | null;
  movement_status: "inside" | "outside" | "overdue";
}

interface UseStudentLiveStatusOptions {
  hostelType?: "boys" | "girls" | null;
  refreshInterval?: number; // ms, default 30000
}

export function useStudentLiveStatus(options: UseStudentLiveStatusOptions = {}) {
  const { hostelType, refreshInterval = 30000 } = options;
  const [data, setData] = useState<StudentLiveStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    let query = supabase.from("student_live_status" as any).select("*");

    if (hostelType) {
      query = query.eq("hostel_type", hostelType);
    }

    const { data: result, error } = await query;

    if (!error && result) {
      setData(result as unknown as StudentLiveStatus[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [hostelType, refreshInterval]);

  const summary = {
    total: data.length,
    inside: data.filter((s) => s.movement_status === "inside").length,
    outside: data.filter((s) => s.movement_status === "outside").length,
    overdue: data.filter((s) => s.movement_status === "overdue").length,
  };

  return { data, loading, summary, refetch: fetchStatus };
}

export function useSingleStudentStatus(userId: string | null) {
  const [status, setStatus] = useState<"inside" | "outside" | "overdue">("inside");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from("student_live_status" as any)
        .select("movement_status")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        setStatus((data as any).movement_status);
      }
      setLoading(false);
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  return { status, loading };
}
