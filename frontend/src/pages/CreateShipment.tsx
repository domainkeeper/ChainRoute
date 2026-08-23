import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useCreateShipment } from "@/hooks/useShipments";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { QRDisplay } from "@/components/ui/QRDisplay";
import { AlertCircle, Loader2, CheckCircle, Truck, ArrowRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WriteResponse } from "@/types/api";
import { toast } from "sonner";

const createShipmentSchema = z.object({
  origin: z.string().min(2, "Origin must be at least 2 characters"),
  destination: z.string().min(2, "Destination must be at least 2 characters"),
  cargo_description: z.string().min(2, "Cargo description must be at least 2 characters"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

type CreateShipmentForm = z.infer<typeof createShipmentSchema>;

const StatusBadgeDisplay = ({ status }: { status: string }) => (
  <span className={`
    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
    bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200
  `}>
    {status}
  </span>
);

export function CreateShipmentPage() {
  const navigate = useNavigate();
  const [submittedShipment, setSubmittedShipment] = useState<WriteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setError: setFieldError, formState: { errors } } = useForm<CreateShipmentForm>({
    resolver: zodResolver(createShipmentSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  const createMutation = useCreateShipment();

  const onSubmit = async (data: CreateShipmentForm) => {
    setError(null);
    try {
      const response = await createMutation.mutateAsync(data);
      setSubmittedShipment(response);
      toast.success("Shipment created successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create shipment";
      if (message.includes("VALIDATION_ERROR")) {
        // Try to parse field errors
        try {
          const parsed = JSON.parse(message.replace("VALIDATION_ERROR: ", ""));
          if (parsed.errors) {
            Object.entries(parsed.errors).forEach(([field, msg]) => {
              setFieldError(field as keyof CreateShipmentForm, { type: "manual", message: msg as string });
            });
          }
        } catch {
          setError(message);
        }
      } else {
        setError(message);
      }
      toast.error(message);
    }
  };

  if (submittedShipment) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold">Shipment Created!</h1>
          <p className="text-muted-foreground mt-2">
            Your shipment has been recorded on the blockchain.
          </p>
        </div>

        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Shipment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">QR Code</label>
                <code className="font-mono text-lg bg-muted px-2 py-1 rounded">{submittedShipment.shipment.qr_code_value}</code>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Chain Reference</label>
                <code className="font-mono text-sm">{submittedShipment.shipment.chain_shipment_ref}</code>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <StatusBadgeDisplay status={submittedShipment.shipment.status} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Blockchain Tx</label>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm bg-muted px-2 py-1 rounded flex-1">
                    {submittedShipment.tx_hash.slice(0, 20)}...
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(submittedShipment.tx_hash)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <QRDisplay 
              value={submittedShipment.shipment.qr_code_value} 
              size={200} 
              label="Print or save this QR code for the shipment"
            />

            <div className="flex gap-4">
              <Button onClick={() => navigate(`/shipments/${submittedShipment.shipment.id}`)}>
                View Shipment
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
              <Button variant="outline" onClick={() => setSubmittedShipment(null)}>
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Truck className="h-8 w-8 text-primary" />
          Create Shipment
        </h1>
        <p className="text-muted-foreground mt-2">
          Create a new shipment with a unique digital identity on the blockchain.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipment Information</CardTitle>
          <CardDescription>
            Fill in the details below. The shipment will be created with a unique QR code and recorded on the blockchain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className={cn("p-3 rounded-lg text-sm", "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300")}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="origin">Origin *</Label>
              <Input
                id="origin"
                placeholder="Shanghai, China"
                {...register("origin")}
                disabled={createMutation.isPending}
                aria-invalid={!!errors.origin}
              />
              {errors.origin && <p className="text-sm text-red-500">{errors.origin.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Destination *</Label>
              <Input
                id="destination"
                placeholder="Los Angeles, USA"
                {...register("destination")}
                disabled={createMutation.isPending}
                aria-invalid={!!errors.destination}
              />
              {errors.destination && <p className="text-sm text-red-500">{errors.destination.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo_description">Cargo Description *</Label>
              <Textarea
                id="cargo_description"
                placeholder="Electronics, machinery, etc."
                {...register("cargo_description")}
                disabled={createMutation.isPending}
                aria-invalid={!!errors.cargo_description}
                rows={3}
              />
              {errors.cargo_description && <p className="text-sm text-red-500">{errors.cargo_description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                {...register("quantity", { valueAsNumber: true })}
                disabled={createMutation.isPending}
                aria-invalid={!!errors.quantity}
              />
              {errors.quantity && <p className="text-sm text-red-500">{errors.quantity.message}</p>}
            </div>

            <div className="pt-4 border-t flex gap-4">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Shipment...
                  </>
                ) : (
                  <>
                    <Truck className="mr-2 h-4 w-4" />
                    Create Shipment
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/dashboard")} disabled={createMutation.isPending}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info about what happens next */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="pt-6">
          <h3 className="font-medium flex items-center gap-2 mb-3">
            <ArrowRight className="h-5 w-5" />
            What happens next?
          </h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Shipment is created with status <strong>CREATED</strong></li>
            <li>Unique QR code is generated (CR-XXXXXX)</li>
            <li>Transaction is submitted to blockchain (takes 5-30 seconds)</li>
            <li>As admin, you can then <strong>assign a transporter</strong></li>
            <li>Transporter records <strong>pickup</strong> → status becomes <strong>PICKED_UP</strong></li>
            <li>Custodian records <strong>checkpoints</strong> during transit</li>
            <li>Custody can be <strong>transferred</strong> to next party</li>
            <li>Final receiver marks <strong>delivery</strong> → status becomes <strong>DELIVERED</strong></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}