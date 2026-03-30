import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StudentTableCellProps {
  fullName: string;
  studentId?: string | null;
  photoUrl?: string | null;
  hostelType?: string | null;
  departmentName?: string | null;
  yearOfStudy?: number | null;
  roomNumber?: string | null;
  showHostelBadge?: boolean;
}

export default function StudentTableCell({
  fullName,
  studentId,
  photoUrl,
  hostelType,
  departmentName,
  yearOfStudy,
  roomNumber,
  showHostelBadge = true,
}: StudentTableCellProps) {
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={photoUrl || undefined} alt={fullName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">{fullName}</span>
                {showHostelBadge && hostelType && (
                  <Badge
                    variant={hostelType === "boys" ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    {hostelType === "boys" ? "B" : "G"}
                  </Badge>
                )}
              </div>
              {studentId && (
                <span className="text-xs text-muted-foreground">{studentId}</span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs space-y-1">
          <p><strong>Department:</strong> {departmentName || "N/A"}</p>
          <p><strong>Year:</strong> {yearOfStudy ? `Year ${yearOfStudy}` : "N/A"}</p>
          <p><strong>Room:</strong> {roomNumber || "Unassigned"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
