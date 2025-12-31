import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Key, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  room_number: string;
  floor: number;
  capacity: number;
  occupied: number;
  key_a_holder: string | null;
  key_b_holder: string | null;
}

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  key_number: string | null;
  key_issued_at: string | null;
}

interface RoomDetails extends Room {
  students: Student[];
}

export default function RoomKeyManagement() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("floor", { ascending: true })
      .order("room_number", { ascending: true });

    if (error) {
      toast({
        title: "Error fetching rooms",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setRooms(data || []);
    }
    setLoading(false);
  };

  const fetchRoomDetails = async (roomId: string) => {
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError) {
      toast({
        title: "Error fetching room details",
        description: roomError.message,
        variant: "destructive",
      });
      return;
    }

    const { data: studentsData, error: studentsError } = await supabase
      .from("profiles")
      .select("id, full_name, student_id, key_number, key_issued_at")
      .eq("room_id", roomId);

    if (studentsError) {
      toast({
        title: "Error fetching students",
        description: studentsError.message,
        variant: "destructive",
      });
      return;
    }

    setSelectedRoom({
      ...roomData,
      students: studentsData || [],
    });
    setIsModalOpen(true);
  };

  const handleKeyAction = async (
    studentId: string,
    keyNumber: "A" | "B",
    action: "issue" | "return"
  ) => {
    if (action === "issue") {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          key_number: keyNumber,
          key_issued_at: new Date().toISOString(),
        })
        .eq("id", studentId);

      if (profileError) {
        toast({
          title: "Error issuing key",
          description: profileError.message,
          variant: "destructive",
        });
        return;
      }

      const keyField = keyNumber === "A" ? "key_a_holder" : "key_b_holder";
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ [keyField]: studentId })
        .eq("id", selectedRoom?.id);

      if (roomError) {
        toast({
          title: "Error updating room",
          description: roomError.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Key issued successfully",
        description: `Key ${keyNumber} has been issued to the student.`,
      });
    } else {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          key_number: null,
          key_issued_at: null,
        })
        .eq("id", studentId);

      if (profileError) {
        toast({
          title: "Error returning key",
          description: profileError.message,
          variant: "destructive",
        });
        return;
      }

      const keyField =
        selectedRoom?.students.find((s) => s.id === studentId)?.key_number === "A"
          ? "key_a_holder"
          : "key_b_holder";
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ [keyField]: null })
        .eq("id", selectedRoom?.id);

      if (roomError) {
        toast({
          title: "Error updating room",
          description: roomError.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Key returned successfully",
        description: "The key has been returned.",
      });
    }

    if (selectedRoom) {
      fetchRoomDetails(selectedRoom.id);
    }
    fetchRooms();
  };

  useEffect(() => {
    fetchRooms();

    const channel = supabase
      .channel("room-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => fetchRooms()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          fetchRooms();
          if (selectedRoom) {
            fetchRoomDetails(selectedRoom.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getRoomColor = (occupied: number, capacity: number) => {
    if (occupied === 0) return "bg-green-500/20 border-green-500";
    if (occupied < capacity) return "bg-yellow-500/20 border-yellow-500";
    return "bg-red-500/20 border-red-500";
  };

  const getFloorName = (floor: number) => {
    switch (floor) {
      case 0:
        return "Ground Floor";
      case 1:
        return "First Floor";
      case 2:
        return "Second Floor";
      case 3:
        return "Third Floor";
      default:
        return `Floor ${floor}`;
    }
  };

  const groupedRooms = rooms.reduce((acc, room) => {
    const floor = room.floor;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  if (loading) {
    return <div className="p-6">Loading rooms...</div>;
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Room Key Management</h2>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-sm">Vacant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded" />
            <span className="text-sm">Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded" />
            <span className="text-sm">Full</span>
          </div>
        </div>
      </div>

      {Object.keys(groupedRooms)
        .sort((a, b) => Number(a) - Number(b))
        .map((floor) => (
          <div key={floor}>
            <h3 className="text-xl font-semibold mb-4">{getFloorName(Number(floor))}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {groupedRooms[Number(floor)].map((room) => (
                <Card
                  key={room.id}
                  className={cn(
                    "cursor-pointer hover:shadow-lg transition-all border-2",
                    getRoomColor(room.occupied, room.capacity)
                  )}
                  onClick={() => fetchRoomDetails(room.id)}
                >
                  <CardContent className="p-4">
                    <div className="text-center space-y-2">
                      <div className="font-bold text-lg">{room.room_number}</div>
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <Users className="w-4 h-4" />
                        <span>
                          {room.occupied}/{room.capacity}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs">
                        <Key className="w-3 h-3" />
                        <span>
                          {[room.key_a_holder, room.key_b_holder].filter(Boolean).length}/2
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Room {selectedRoom?.room_number} Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Floor:</span>
                <p className="font-medium">{selectedRoom && getFloorName(selectedRoom.floor)}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Occupancy:</span>
                <p className="font-medium">
                  {selectedRoom?.occupied}/{selectedRoom?.capacity}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Key Status</h4>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Key A</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedRoom?.key_a_holder ? (
                      <Badge variant="destructive">Issued</Badge>
                    ) : (
                      <Badge variant="secondary">Available</Badge>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Key B</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedRoom?.key_b_holder ? (
                      <Badge variant="destructive">Issued</Badge>
                    ) : (
                      <Badge variant="secondary">Available</Badge>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Students</h4>
              {selectedRoom?.students && selectedRoom.students.length > 0 ? (
                <div className="space-y-3">
                  {selectedRoom.students.map((student) => (
                    <Card key={student.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{student.full_name}</p>
                            <p className="text-sm text-muted-foreground">{student.student_id}</p>
                            {student.key_number && (
                              <Badge variant="outline" className="mt-1">
                                Key {student.key_number}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {!student.key_number ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleKeyAction(student.id, "A", "issue")}
                                  disabled={!!selectedRoom.key_a_holder}
                                >
                                  Issue Key A
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleKeyAction(student.id, "B", "issue")}
                                  disabled={!!selectedRoom.key_b_holder}
                                >
                                  Issue Key B
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleKeyAction(student.id, student.key_number as "A" | "B", "return")}
                              >
                                Return Key
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No students assigned to this room.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
