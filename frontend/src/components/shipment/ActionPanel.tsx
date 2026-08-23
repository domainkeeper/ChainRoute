import { useAuth } from "@/context/AuthContext";
import { useAssignTransporter, usePickup, useCheckpoint, useHandoff, useDeliver, useUsers, useVehicles } from "@/hooks/useShipments";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AlertCircle, Loader2, Truck, MapPin, ArrowRight, Package, CheckCircle } from "lucide-react";
import { useState } from "react";
import type { Shipment, UserRole, User, Vehicle } from "@/types/api";

interface ActionPanelProps {
  shipment: Shipment;
  currentUserRole: UserRole | null;
  currentUserId: string | null;
  onSuccess?: () => void;
}

export function ActionPanel({ shipment, currentUserRole, currentUserId, onSuccess }: ActionPanelProps) {
  const { user } = useAuth();
  const isTransporter = currentUserRole === "transporter";
  const isAdmin = currentUserRole === "admin";
  const isCustodian = currentUserId !== null && shipment.current_custodian_id === currentUserId;
  const isAssignedTransporter = currentUserId !== null && shipment.current_transporter_id === currentUserId;

  const assignMutation = useAssignTransporter();
  const pickupMutation = usePickup();
  const checkpointMutation = useCheckpoint();
  const handoffMutation = useHandoff();
  const deliverMutation = useDeliver();

  const { data: transporters } = useUsers("transporter");
  const { data: vehicles } = useVehicles();

  const [assignForm, setAssignForm] = useState({ transporter_id: "", vehicle_id: "" });
  const [checkpointForm, setCheckpointForm] = useState({ location: "", note: "" });
  const [handoffForm, setHandoffForm] = useState({ to_user_id: "" });

  const getNextAction = () => {
    if (shipment.status === "CREATED" && isAdmin) {
      return "assign";
    }
    if (shipment.status === "ASSIGNED" && isAssignedTransporter) {
      return "pickup";
    }
    if (shipment.status === "CUSTODY_TRANSFERRED" && isCustodian && currentUserRole === "receiver") {
      return "deliver";
    }
    if (["PICKED_UP", "IN_TRANSIT", "AT_WAREHOUSE", "CUSTODY_TRANSFERRED"].includes(shipment.status) && isCustodian) {
      return "checkpoint_handoff";
    }
    if (shipment.status === "DELIVERED") {
      return "delivered";
    }
    return "waiting";
  };

  const action = getNextAction();

  if (action === "waiting") {
    return (
      <Card className="border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Waiting for action</p>
              <p className="text-sm text-muted-foreground">
                This shipment is waiting for the assigned party to take action.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (action === "delivered") {
    return (
      <Card className="border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Shipment Delivered</p>
              <p className="text-sm text-muted-foreground">
                This shipment has been successfully delivered.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Next Action
        </CardTitle>
      </CardHeader>
      <CardContent>
        {action === "assign" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign a transporter to this shipment. The transporter must have a wallet address configured.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transporter">Transporter *</Label>
                <Select
                  id="transporter"
                  value={assignForm.transporter_id}
                  onChange={(e) => setAssignForm({ ...assignForm, transporter_id: e.target.value })}
                  disabled={assignMutation.isPending}
                >
                  <option value="">Select transporter</option>
                  {transporters?.users
                    .filter((t: User) => t.wallet_address)
                    .map((t: User) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email}) - {t.wallet_address?.slice(0, 10)}...
                      </option>
                    ))}
                </Select>
                {transporters?.users.filter((t: User) => t.wallet_address).length === 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    No transporters with wallet addresses found. Create a transporter user first.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle (Optional)</Label>
                <Select
                  id="vehicle"
                  value={assignForm.vehicle_id}
                  onChange={(e) => setAssignForm({ ...assignForm, vehicle_id: e.target.value })}
                  disabled={assignMutation.isPending || !assignForm.transporter_id}
                >
                  <option value="">No vehicle</option>
                  {assignForm.transporter_id &&
                    vehicles?.vehicles
                      .filter((v: Vehicle) => v.transporter_id === assignForm.transporter_id)
                      .map((v: Vehicle) => (
                        <option key={v.id} value={v.id}>
                          {v.plate_number} ({v.type})
                        </option>
                      ))}
                </Select>
              </div>
            </div>
            <Button
              onClick={() => assignMutation.mutate(
                { id: shipment.id, ...assignForm },
                { onSuccess: () => onSuccess?.() }
              )}
              disabled={assignMutation.isPending || !assignForm.transporter_id}
              className="w-full"
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Transporter"
              )}
            </Button>
          </div>
        )}

        {action === "pickup" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Record pickup of the shipment. This will update the status to <strong>PICKED_UP</strong> and set you as the current custodian.
            </p>
            <Button
              onClick={() => pickupMutation.mutate(shipment.id, { onSuccess: () => onSuccess?.() })}
              disabled={pickupMutation.isPending}
              className="w-full"
            >
              {pickupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording Pickup...
                </>
              ) : (
                <>
                  <Truck className="mr-2 h-4 w-4" />
                  Record Pickup
                </>
              )}
            </Button>
          </div>
        )}

        {action === "checkpoint_handoff" && (
          <div className="space-y-6">
            <div className="space-y-4 border-t pt-6">
              <h4 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Record Checkpoint
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Port of Shanghai, Warehouse A"
                    value={checkpointForm.location}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, location: e.target.value })}
                    disabled={checkpointMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note (Optional)</Label>
                  <Textarea
                    id="note"
                    placeholder="e.g., Loaded onto vessel, customs cleared"
                    value={checkpointForm.note}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, note: e.target.value })}
                    disabled={checkpointMutation.isPending}
                    rows={2}
                  />
                </div>
                <Button
                  onClick={() => checkpointMutation.mutate(
                    { id: shipment.id, ...checkpointForm },
                    { onSuccess: () => { setCheckpointForm({ location: "", note: "" }); onSuccess?.(); } }
                  )}
                  disabled={checkpointMutation.isPending || !checkpointForm.location}
                  className="w-full"
                >
                  {checkpointMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    "Record Checkpoint"
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h4 className="font-medium flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Transfer Custody
              </h4>
              <p className="text-sm text-muted-foreground">
                Transfer custody to another party. The recipient must have a wallet address configured.
              </p>
              <div className="space-y-2">
                <Label htmlFor="to_user">Transfer To *</Label>
                <Select
                  id="to_user"
                  value={handoffForm.to_user_id}
                  onChange={(e) => setHandoffForm({ ...handoffForm, to_user_id: e.target.value })}
                  disabled={handoffMutation.isPending}
                >
                  <option value="">Select recipient</option>
                  {transporters?.users
                    .filter((u: User) => u.wallet_address && u.id !== currentUserId)
                    .map((u: User) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role}) - {u.wallet_address?.slice(0, 10)}...
                      </option>
                    ))}
                </Select>
              </div>
              <Button
                variant="secondary"
                onClick={() => handoffMutation.mutate(
                  { id: shipment.id, to_user_id: handoffForm.to_user_id },
                  { onSuccess: () => { setHandoffForm({ to_user_id: "" }); onSuccess?.(); } }
                )}
                disabled={handoffMutation.isPending || !handoffForm.to_user_id}
                className="w-full"
              >
                {handoffMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Transfer Custody
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {action === "deliver" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-green-700 dark:text-green-300 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Mark as Delivered</p>
                <p className="text-sm text-muted-foreground">
                  Confirm final delivery of this shipment. This will update the status to <strong>DELIVERED</strong>.
                </p>
              </div>
            </div>
            <Button
              onClick={() => deliverMutation.mutate(shipment.id, { onSuccess: () => onSuccess?.() })}
              disabled={deliverMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {deliverMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Delivering...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark Delivered
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}