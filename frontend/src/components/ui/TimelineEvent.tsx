import { cn } from "@/lib/utils";
import { eventColors, eventLabels, formatDateTime, shortHash, getExplorerUrl } from "@/lib/utils";
import { TxHashChip } from "./TxHashChip";
import { IdentityChip } from "./IdentityChip";
import { ExternalLink } from "lucide-react";
import type { ShipmentEvent, Checkpoint, CustodyTransfer, User } from "@/types/api";

interface TimelineEventProps {
  type: "event" | "checkpoint" | "transfer";
  event?: ShipmentEvent;
  checkpoint?: Checkpoint;
  transfer?: CustodyTransfer;
  actor?: User;
  fromUser?: User;
  toUser?: User;
  index: number;
  total: number;
}

export function TimelineEvent({ type, event, checkpoint, transfer, actor, fromUser, toUser, index, total }: TimelineEventProps) {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (type === "event" && event) {
    const color = eventColors[event.event_type] || "bg-gray-500";
    const label = eventLabels[event.event_type] || event.event_type;

    return (
      <div className="relative flex gap-4">
        <div className="relative flex flex-col items-center flex-shrink-0">
          <div className={cn("w-4 h-4 rounded-full border-4 border-background z-10", color)} />
          {!isFirst && <div className="h-full w-0.5 bg-border" />}
          {!isLast && <div className="h-full w-0.5 bg-border" />}
        </div>
        <div className="flex-1 min-w-0 pt-1 pb-4">
          <div className="flex items-start gap-3">
            <div className={cn("px-3 py-2 rounded-lg border", "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800")}>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded", "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200")}>
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</span>
              </div>
              {actor && <IdentityChip user={actor} compact />}
              {event.tx_hash && <TxHashChip txHash={event.tx_hash} />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "checkpoint" && checkpoint) {
    return (
      <div className="relative flex gap-4">
        <div className="relative flex flex-col items-center flex-shrink-0">
          <div className="w-4 h-4 rounded-full border-4 border-background bg-amber-500 z-10" />
          {!isFirst && <div className="h-full w-0.5 bg-border" />}
          {!isLast && <div className="h-full w-0.5 bg-border" />}
        </div>
        <div className="flex-1 min-w-0 pt-1 pb-4">
          <div className="flex items-start gap-3">
            <div className="px-3 py-2 rounded-lg border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                  Checkpoint
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(checkpoint.created_at)}</span>
              </div>
              <div className="space-y-1">
                <p className="font-medium">{checkpoint.location}</p>
                {checkpoint.note && <p className="text-sm text-muted-foreground">{checkpoint.note}</p>}
                {checkpoint.recorded_by && actor && <IdentityChip user={actor} compact />}
                {checkpoint.tx_hash && <TxHashChip txHash={checkpoint.tx_hash} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "transfer" && transfer) {
    return (
      <div className="relative flex gap-4">
        <div className="relative flex flex-col items-center flex-shrink-0">
          <div className="w-4 h-4 rounded-full border-4 border-background bg-purple-500 z-10" />
          {!isFirst && <div className="h-full w-0.5 bg-border" />}
          {!isLast && <div className="h-full w-0.5 bg-border" />}
        </div>
        <div className="flex-1 min-w-0 pt-1 pb-4">
          <div className="flex items-start gap-3">
            <div className="px-3 py-2 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                  Custody Transfer
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(transfer.created_at)}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">From:</span>
                  {fromUser && <IdentityChip user={fromUser} compact />}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">To:</span>
                  {toUser && <IdentityChip user={toUser} compact />}
                </div>
                {transfer.tx_hash && <TxHashChip txHash={transfer.tx_hash} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
