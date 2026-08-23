import { cn } from "@/lib/utils";
import { shortHash, getExplorerUrl } from "@/lib/utils";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

interface TxHashChipProps {
  txHash: string | null | undefined;
  network?: "sepolia" | "mainnet" | "polygon" | "mumbai";
  pending?: boolean;
  showLabel?: boolean;
}

export function TxHashChip({ txHash, network = "sepolia", pending = false, showLabel = false }: TxHashChipProps) {
  const [copied, setCopied] = useState(false);

  if (!txHash) {
    return <span className="text-muted-foreground">—</span>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = getExplorerUrl(txHash, network);

  return (
    <div className="flex items-center gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      <span className={cn("font-mono text-sm", "break-all")}>
        {showLabel && <span className="text-muted-foreground mr-1">Tx:</span>}
        {shortHash(txHash)}
      </span>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-primary transition-colors"
        title="View on explorer"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <button
        onClick={handleCopy}
        className="text-muted-foreground hover:text-primary transition-colors p-1"
        title={copied ? "Copied!" : "Copy hash"}
      >
        {copied ? <span className="text-green-500">✓</span> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
