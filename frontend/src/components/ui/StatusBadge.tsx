import { Badge } from "./Badge";
import { statusColors, statusLabels } from "@/lib/utils";
import type { ShipmentStatus } from "@/types/api";

interface StatusBadgeProps {
  status: ShipmentStatus;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <Badge className={`${statusColors[status]} ${sizeClasses[size]} capitalize`}>
      {statusLabels[status] || status}
    </Badge>
  );
}
