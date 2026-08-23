import { Badge } from "./Badge";
import { roleColors, roleLabels } from "@/lib/utils";
import type { UserRole } from "@/types/api";

interface RoleBadgeProps {
  role: UserRole;
  size?: "sm" | "md" | "lg";
}

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <Badge className={`${roleColors[role]} ${sizeClasses[size]} capitalize`}>
      {roleLabels[role] || role}
    </Badge>
  );
}
