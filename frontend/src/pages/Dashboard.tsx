import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useShipments } from "@/hooks/useShipments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IdentityChip } from "@/components/ui/IdentityChip";
import { Truck, Plus, Search, Filter, Loader2 } from "lucide-react";
import { formatRelativeTime, statusLabels } from "@/lib/utils";
import type { Shipment, ShipmentStatus, UserRole } from "@/types/api";

const STATUS_OPTIONS: { value: ShipmentStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "CREATED", label: "Created" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "AT_WAREHOUSE", label: "At Warehouse" },
  { value: "CUSTODY_TRANSFERRED", label: "Custody Transferred" },
  { value: "DELIVERED", label: "Delivered" },
];

export function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "">("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: shipmentsResponse, isLoading } = useShipments({
    status_filter: statusFilter || undefined,
    limit: 50,
  });

  const shipments = shipmentsResponse?.shipments || [];
  const total = shipmentsResponse?.total || 0;

  const filteredShipments = shipments.filter((shipment: Shipment) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.role === "transporter") {
      return shipment.current_transporter_id === user.id || 
             shipment.current_custodian_id === user.id ||
             shipment.manufacturer_id === user.id;
    }
    return shipment.current_custodian_id === user.id || shipment.manufacturer_id === user.id;
  });

  const searchedShipments = filteredShipments.filter((shipment: Shipment) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      shipment.qr_code_value.toLowerCase().includes(query) ||
      shipment.origin.toLowerCase().includes(query) ||
      shipment.destination.toLowerCase().includes(query) ||
      shipment.cargo_description.toLowerCase().includes(query) ||
      shipment.id.toLowerCase().includes(query)
    );
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusCounts = () => {
    const counts: Record<string, number> = {};
    shipments.forEach((s: Shipment) => {
      counts[s.status] = (counts[s.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name}. Manage your shipments here.
          </p>
        </div>
        {user?.role === "admin" && (
          <Link to="/shipments/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Shipment
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-sm text-muted-foreground">Total Shipments</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Truck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        {["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "CUSTODY_TRANSFERRED", "DELIVERED"].map((status) => (
          <Card key={status}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{statusCounts[status] || 0}</p>
                  <p className="text-sm text-muted-foreground">{statusLabels[status]}</p>
                </div>
                <StatusBadge status={status as ShipmentStatus} size="sm" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shipments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ShipmentStatus | "")}
                className="w-48"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : searchedShipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No shipments found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter ? "Try adjusting your filters" : "Get started by creating a shipment"}
              </p>
              {user?.role === "admin" && !searchQuery && !statusFilter && (
                <Link to="/shipments/create" className="mt-4">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Shipment
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Shipment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Custodian
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {searchedShipments.map((shipment: Shipment) => (
                    <tr key={shipment.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-mono text-sm font-medium">{shipment.qr_code_value}</p>
                          <p className="text-xs text-muted-foreground">{shipment.cargo_description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p>{shipment.origin}</p>
                          <p className="text-muted-foreground">{shipment.destination}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={shipment.status} />
                      </td>
                      <td className="px-4 py-4">
                        {shipment.current_custodian_id ? (
                          <IdentityChip user={{ 
                            id: shipment.current_custodian_id, 
                            name: "Current Custodian", 
                            email: "", 
                            role: "viewer" as UserRole, 
                            wallet_address: null, 
                            created_at: "" 
                          }} compact />
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {formatRelativeTime(shipment.updated_at)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link to={`/shipments/${shipment.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}