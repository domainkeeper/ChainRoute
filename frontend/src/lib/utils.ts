import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string | null | undefined, chars = 6): string {
  if (!address) return "—";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function shortHash(hash: string | null | undefined, chars = 10): string {
  if (!hash) return "—";
  if (hash.length <= chars + 2) return hash;
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`;
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const statusColors: Record<string, string> = {
  CREATED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  ASSIGNED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  PICKED_UP: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  IN_TRANSIT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  AT_WAREHOUSE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  CUSTODY_TRANSFERRED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export const statusLabels: Record<string, string> = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  PICKED_UP: "Picked Up",
  IN_TRANSIT: "In Transit",
  AT_WAREHOUSE: "At Warehouse",
  CUSTODY_TRANSFERRED: "Custody Transferred",
  DELIVERED: "Delivered",
};

export const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  transporter: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warehouse_operator: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  distributor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  receiver: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export const roleLabels: Record<string, string> = {
  admin: "Admin",
  transporter: "Transporter",
  warehouse_operator: "Warehouse Operator",
  distributor: "Distributor",
  receiver: "Receiver",
  viewer: "Viewer",
};

export const eventColors: Record<string, string> = {
  CREATED: "bg-gray-500",
  ASSIGNED: "bg-blue-500",
  PICKED_UP: "bg-indigo-500",
  CHECKPOINT: "bg-amber-500",
  CUSTODY_TRANSFER: "bg-purple-500",
  DELIVERED: "bg-green-500",
};

export const eventLabels: Record<string, string> = {
  CREATED: "Created",
  ASSIGNED: "Transporter Assigned",
  PICKED_UP: "Pickup Recorded",
  CHECKPOINT: "Checkpoint",
  CUSTODY_TRANSFER: "Custody Transfer",
  DELIVERED: "Delivered",
};

export function getExplorerUrl(txHash: string, network = "sepolia"): string {
  const explorers: Record<string, string> = {
    sepolia: "https://sepolia.etherscan.io/tx/",
    mainnet: "https://etherscan.io/tx/",
    polygon: "https://polygonscan.com/tx/",
    mumbai: "https://mumbai.polygonscan.com/tx/",
  };
  return `${explorers[network] || explorers.sepolia}${txHash}`;
}