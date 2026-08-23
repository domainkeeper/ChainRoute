import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useShipment, useShipmentHistory } from "@/hooks/useShipments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { IdentityChip } from "@/components/ui/IdentityChip";
import { TxHashChip } from "@/components/ui/TxHashChip";
import { QRDisplay } from "@/components/ui/QRDisplay";
import { StatusPipeline } from "@/components/ui/StatusPipeline";
import { MapView } from "@/components/ui/MapView";
import { ActionPanel } from "@/components/shipment/ActionPanel";
import { TimelineEvent } from "@/components/ui/TimelineEvent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import { Loader2, Copy, AlertCircle, MapPin, Truck, Package, History, QrCode } from "lucide-react";
import type { ShipmentEvent, Checkpoint, CustodyTransfer } from "@/types/api";
import { toast } from "sonner";

export function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("details");

  const { data: shipment, isLoading, error, refetch } = useShipment(id || "");
  const { data: history, isLoading: historyLoading } = useShipmentHistory(id || "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Shipment not found</h3>
          <p className="text-muted-foreground mt-2">The shipment you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isCurrentTransporter = user && shipment.current_transporter_id === user.id;
  const isCurrentCustodian = user && shipment.current_custodian_id === user.id;
  const isManufacturer = user && shipment.manufacturer_id === user.id;
  const isAdmin = user?.role === "admin";

  const handleActionSuccess = () => {
    refetch();
    toast.success("Action completed successfully!");
  };

  const YesNoBadge = ({ yes }: { yes: boolean }) => (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      ${yes ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"}
    `}>
      {yes ? "Yes" : "No"}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            {shipment.qr_code_value}
          </h1>
          <p className="text-muted-foreground mt-1">{shipment.cargo_description}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={shipment.status} size="lg" />
        </div>
      </div>

      {/* Status Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Shipment Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusPipeline currentStatus={shipment.status} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Tab */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 pt-4">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Shipment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">QR Code Value</label>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm bg-muted px-2 py-1 rounded flex-1">{shipment.qr_code_value}</code>
                        <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(shipment.qr_code_value)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Chain Reference</label>
                      <code className="font-mono text-sm">{shipment.chain_shipment_ref}</code>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Quantity</label>
                      <p>{shipment.quantity}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Created</label>
                      <p>{formatDateTime(shipment.created_at)}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Last Updated</label>
                      <p>{formatDateTime(shipment.updated_at)}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Creation Tx Hash</label>
                      {shipment.creation_tx_hash && (
                        <TxHashChip txHash={shipment.creation_tx_hash} />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Route Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Route
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1 p-4 bg-muted/50 rounded-lg">
                      <label className="text-xs text-muted-foreground">Origin</label>
                      <p className="font-medium">{shipment.origin}</p>
                    </div>
                    <div className="space-y-1 p-4 bg-muted/50 rounded-lg">
                      <label className="text-xs text-muted-foreground">Destination</label>
                      <p className="font-medium">{shipment.destination}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Participants */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Participants
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2 p-4 border rounded-lg">
                      <label className="text-xs text-muted-foreground">Manufacturer</label>
                      <IdentityChip 
                        user={{ 
                          id: shipment.manufacturer_id, 
                          name: "Manufacturer", 
                          email: "", 
                          role: "admin" as const, 
                          wallet_address: null, 
                          created_at: "" 
                        }} 
                      />
                    </div>
                    <div className="space-y-2 p-4 border rounded-lg">
                      <label className="text-xs text-muted-foreground">Assigned Transporter</label>
                      {shipment.current_transporter_id ? (
                        <IdentityChip 
                          user={{ 
                            id: shipment.current_transporter_id, 
                            name: "Transporter", 
                            email: "", 
                            role: "transporter" as const, 
                            wallet_address: null, 
                            created_at: "" 
                          }} 
                        />
                      ) : (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </div>
                    <div className="space-y-2 p-4 border rounded-lg">
                      <label className="text-xs text-muted-foreground">Current Custodian</label>
                      {shipment.current_custodian_id ? (
                        <IdentityChip 
                          user={{ 
                            id: shipment.current_custodian_id, 
                            name: "Custodian", 
                            email: "", 
                            role: "viewer" as const, 
                            wallet_address: null, 
                            created_at: "" 
                          }} 
                        />
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>

                  {shipment.vehicle_id && (
                    <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                      <label className="text-xs text-muted-foreground">Vehicle</label>
                      <p>Vehicle ID: {shipment.vehicle_id}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* QR Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <QRDisplay value={shipment.qr_code_value} size={256} label="Scan to view shipment" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="map" className="pt-4">
              <Card>
                <CardContent className="pt-0">
                  <MapView shipment={shipment} checkpoints={history?.checkpoints || []} height="500px" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Verification History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {history?.events && history.events.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">Events</h4>
                          <div className="space-y-4">
                            {history.events.map((event: ShipmentEvent, index: number) => (
                              <TimelineEvent
                                key={event.id}
                                type="event"
                                event={event}
                                actor={undefined}
                                index={index}
                                total={history.events.length}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {history?.checkpoints && history.checkpoints.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">Checkpoints</h4>
                          <div className="space-y-4">
                            {history.checkpoints.map((checkpoint: Checkpoint, index: number) => (
                              <TimelineEvent
                                key={checkpoint.id}
                                type="checkpoint"
                                checkpoint={checkpoint}
                                actor={undefined}
                                index={index}
                                total={history.checkpoints.length}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {history?.custody_transfers && history.custody_transfers.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">Custody Transfers</h4>
                          <div className="space-y-4">
                            {history.custody_transfers.map((transfer: CustodyTransfer, index: number) => (
                              <TimelineEvent
                                key={transfer.id}
                                type="transfer"
                                transfer={transfer}
                                fromUser={undefined}
                                toUser={undefined}
                                index={index}
                                total={history.custody_transfers.length}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {!history?.events?.length && !history?.checkpoints?.length && !history?.custody_transfers?.length && (
                        <div className="text-center py-8 text-muted-foreground">
                          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>No history records found</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-6">
          <ActionPanel
            shipment={shipment}
            currentUserRole={user?.role || null}
            currentUserId={user?.id || null}
            onSuccess={handleActionSuccess}
          />

          {/* Access Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">Role:</span>
                <RoleBadge role={user?.role || "viewer"} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">Transporter:</span>
                <YesNoBadge yes={!!isCurrentTransporter} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">Custodian:</span>
                <YesNoBadge yes={!!isCurrentCustodian} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">Manufacturer:</span>
                <YesNoBadge yes={!!isManufacturer} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">Admin:</span>
                <YesNoBadge yes={isAdmin} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}