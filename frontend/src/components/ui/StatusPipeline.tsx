import { cn } from "@/lib/utils";
import { statusColors, statusLabels, eventColors } from "@/lib/utils";
import type { ShipmentStatus } from "@/types/api";

const STATUS_ORDER: ShipmentStatus[] = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_WAREHOUSE",
  "CUSTODY_TRANSFERRED",
  "DELIVERED",
];

interface StatusPipelineProps {
  currentStatus: ShipmentStatus;
  className?: string;
}

export function StatusPipeline({ currentStatus, className }: StatusPipelineProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-2", className)}>
      {STATUS_ORDER.map((status, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const isLast = index === STATUS_ORDER.length - 1;

        return (
          <div key={status} className="flex flex-col items-center flex-shrink-0">
            <div className="relative flex items-center">
              <div
                className={cn(
                  "w-3 h-3 rounded-full border-2 transition-all",
                  isCompleted && "bg-primary border-primary",
                  isCurrent && "bg-primary border-primary ring-2 ring-primary ring-offset-2",
                  isFuture && "bg-transparent border-border"
                )}
              >
                {isCompleted && (
                  <svg className="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-full w-16 h-0.5 -ml-1 transition-colors",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                "mt-2 text-xs font-medium text-center whitespace-nowrap w-24 transition-colors",
                isCompleted ? "text-primary" : isCurrent ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {statusLabels[status] || status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
