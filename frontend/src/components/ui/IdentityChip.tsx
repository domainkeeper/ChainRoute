import { cn } from "@/lib/utils";
import { RoleBadge } from "./RoleBadge";
import { shortAddress } from "@/lib/utils";
import { UserCircle, Wallet } from "lucide-react";
import type { User, UserRole } from "@/types/api";

interface IdentityChipProps {
  user: User | null | undefined;
  showRole?: boolean;
  showWallet?: boolean;
  compact?: boolean;
}

export function IdentityChip({ user, showRole = true, showWallet = true, compact = false }: IdentityChipProps) {
  if (!user) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className={cn("flex items-center gap-2", compact && "gap-1")}>
      <UserCircle className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col">
        <span className={cn("font-medium", compact && "text-sm")}>{user.name}</span>
        {showWallet && user.wallet_address && (
          <span className={cn("font-mono text-xs text-muted-foreground", compact && "hidden")}>
            {shortAddress(user.wallet_address)}
          </span>
        )}
      </div>
      {showRole && <RoleBadge role={user.role} size={compact ? "sm" : "md"} />}
    </div>
  );
}
