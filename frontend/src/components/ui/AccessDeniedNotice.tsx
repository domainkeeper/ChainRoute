import { AlertCircle, Shield, Key, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/api";

interface AccessDeniedNoticeProps {
  requiredRole?: UserRole;
  requiredIdentity?: "transporter" | "custodian" | "receiver";
  currentUserRole?: UserRole | null;
  isCurrentTransporter?: boolean;
  isCurrentCustodian?: boolean;
  shipmentStatus?: string;
  className?: string;
}

export function AccessDeniedNotice({
  requiredRole,
  requiredIdentity,
  currentUserRole,
  isCurrentTransporter,
  isCurrentCustodian,
  shipmentStatus,
  className,
}: AccessDeniedNoticeProps) {
  let message = "You don't have permission to perform this action.";
  let details = "";

  if (requiredIdentity === "transporter") {
    if (!isCurrentTransporter) {
      message = "Only the assigned transporter can record pickup.";
      details = "This action is restricted to the transporter assigned to this shipment.";
    }
  } else if (requiredIdentity === "custodian") {
    if (!isCurrentCustodian) {
      message = "Only the current custodian can perform this action.";
      details = "You must be the current custodian of this shipment to record checkpoints or transfer custody.";
    }
  } else if (requiredIdentity === "receiver") {
    if (currentUserRole !== "receiver" || !isCurrentCustodian) {
      message = "Only the current custodian with receiver role can mark delivery.";
      details = "You must be the current custodian and have the receiver role to mark this shipment as delivered.";
    }
  } else if (requiredRole && currentUserRole !== requiredRole) {
    message = `This action requires the ${requiredRole} role.`;
    details = `Your current role: ${currentUserRole || "none"}. Required role: ${requiredRole}.`;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg",
        className
      )}
      role="alert"
    >
      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-red-800 dark:text-red-200">{message}</p>
        {details && <p className="text-sm text-red-700 dark:text-red-300 mt-1">{details}</p>}
        {shipmentStatus && (
          <p className="text-sm text-muted-foreground mt-2">
            Current shipment status: <strong>{shipmentStatus}</strong>
          </p>
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Role: {currentUserRole || "Not logged in"}
          </span>
          {isCurrentTransporter !== undefined && (
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Assigned Transporter: {isCurrentTransporter ? "Yes" : "No"}
            </span>
          )}
          {isCurrentCustodian !== undefined && (
            <span className="flex items-center gap-1">
              <Key className="h-3 w-3" />
              Current Custodian: {isCurrentCustodian ? "Yes" : "No"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
