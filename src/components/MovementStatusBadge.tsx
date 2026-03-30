import { Badge } from "@/components/ui/badge";

type MovementStatus = "inside" | "outside" | "overdue";

interface MovementStatusBadgeProps {
  status: MovementStatus;
  className?: string;
}

const statusConfig: Record<MovementStatus, { label: string; icon: string; className: string }> = {
  inside: {
    label: "Inside",
    icon: "🟢",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  outside: {
    label: "Outside",
    icon: "🔴",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  overdue: {
    label: "Overdue",
    icon: "⚠️",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
};

export default function MovementStatusBadge({ status, className = "" }: MovementStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.inside;

  return (
    <Badge className={`${config.className} ${className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}
