import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useShipments, useVehicles, useCreateVehicle } from "@/hooks/useShipments";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AlertCircle, Wallet, Key, Truck, Plus, Loader2, Copy, Check } from "lucide-react";
import { shortAddress, formatRelativeTime } from "@/lib/utils";
import type { Shipment } from "@/types/api";
import { toast } from "sonner";

export function MyIdentityPage() {
  const { user, updateWallet } = useAuth();
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState("");
  const [showWalletInput, setShowWalletInput] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  const { data: myShipmentsResponse } = useShipments({ limit: 20 });
  const { data: vehiclesResponse } = useVehicles();
  const createVehicleMutation = useCreateVehicle();

  const [vehicleForm, setVehicleForm] = useState({ plate_number: "", type: "" });

  const myShipments = myShipmentsResponse?.shipments.filter((s: Shipment) => 
    s.current_custodian_id === user?.id || s.manufacturer_id === user?.id
  ) || [];

  const myVehicles = vehiclesResponse?.vehicles || [];

  const handleSaveWallet = async () => {
    if (!walletAddress.trim()) {
      toast.error("Please enter a wallet address");
      return;
    }
    if (!walletAddress.startsWith("0x") || walletAddress.length !== 42) {
      toast.error("Invalid wallet address format (must be 0x + 40 hex chars)");
      return;
    }
    setSavingWallet(true);
    try {
      await updateWallet(walletAddress);
      setShowWalletInput(false);
      setWalletAddress("");
      toast.success("Wallet address updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update wallet");
    } finally {
      setSavingWallet(false);
    }
  };

  const handleCopyWallet = () => {
    if (user?.wallet_address) {
      navigator.clipboard.writeText(user.wallet_address);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.plate_number || !vehicleForm.type) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await createVehicleMutation.mutateAsync(vehicleForm);
      setVehicleForm({ plate_number: "", type: "" });
      toast.success("Vehicle created!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create vehicle");
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Please log in to view your identity</h3>
      </div>
    );
  }

  const needsWallet = user.role !== "admin" && user.role !== "viewer" && !user.wallet_address;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Key className="h-8 w-8 text-primary" />
          My Identity
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your decentralized identity, wallet address, and assets.
        </p>
      </div>

      {/* Wallet Alert */}
      {needsWallet && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Wallet Address Required
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your role ({user.role}) requires a wallet address to participate in shipments. 
                  Please add your wallet address below to enable pickup, custody transfer, and delivery actions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <RoleBadge role={user.role} />
                <span className="text-xs text-muted-foreground">
                  ID: {user.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Wallet Address</p>
                  {user.wallet_address ? (
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {shortAddress(user.wallet_address)}
                      </code>
                      <Button variant="ghost" size="icon" onClick={handleCopyWallet}>
                        {copiedWallet ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Not set</span>
                      <Button variant="link" size="sm" onClick={() => setShowWalletInput(true)}>
                        Add wallet
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showWalletInput && (
              <div className="flex items-center gap-2 ml-8">
                <Input
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  disabled={savingWallet}
                  className="w-80"
                />
                <Button onClick={handleSaveWallet} disabled={savingWallet}>
                  {savingWallet ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
                <Button variant="ghost" onClick={() => setShowWalletInput(false)}>
                  Cancel
                </Button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Created</span>
              <span>{new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles (for transporters) */}
      {user.role === "transporter" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              My Vehicles
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => { setVehicleForm({ plate_number: "", type: "" }); setShowVehicleForm(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </CardHeader>
          <CardContent>
            {showVehicleForm ? (
              <form onSubmit={handleCreateVehicle} className="space-y-4 mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="plate_number">Plate Number</Label>
                    <Input
                      id="plate_number"
                      placeholder="ABC-1234"
                      value={vehicleForm.plate_number}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Input
                      id="type"
                      placeholder="Truck, Van, Container"
                      value={vehicleForm.type}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createVehicleMutation.isPending}>
                    {createVehicleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowVehicleForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            {myVehicles.length === 0 && !showVehicleForm ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No vehicles registered</p>
                <Button variant="link" onClick={() => { setVehicleForm({ plate_number: "", type: "" }); setShowVehicleForm(true); }}>
                  Add your first vehicle
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {myVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Truck className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{vehicle.plate_number}</p>
                        <p className="text-sm text-muted-foreground">{vehicle.type}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{vehicle.id.slice(0, 8)}...</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Shipments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            My Shipments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myShipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No shipments associated with your account</p>
              {user.role === "admin" && (
                <Button className="mt-4" onClick={() => navigate("/shipments/create")}>
                  Create Shipment
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {myShipments.map((shipment: Shipment) => (
                <div key={shipment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{shipment.qr_code_value}</p>
                      <p className="text-sm text-muted-foreground">{shipment.cargo_description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={shipment.status} size="sm" />
                    <span className="text-sm text-muted-foreground">
                      {shipment.current_custodian_id === user.id ? "Custodian" : "Manufacturer"}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(shipment.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}