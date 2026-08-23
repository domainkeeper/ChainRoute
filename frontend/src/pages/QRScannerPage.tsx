import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useShipmentByQR } from "@/hooks/useShipments";
import { QRScanner } from "@/components/ui/QRScanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Loader2, Camera, Search, AlertCircle } from "lucide-react";

export function QRScannerPage() {
  const navigate = useNavigate();
  const [manualQR, setManualQR] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const { data: shipment, isLoading, error: queryError } = useShipmentByQR(manualQR);

  const handleScan = (qrValue: string) => {
    setManualQR(qrValue);
    setScannerOpen(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    if (shipment && !isLoading) {
      navigate(`/shipments/${shipment.id}`);
    }
  }, [shipment, isLoading, navigate]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Camera className="h-8 w-8 text-primary" />
          QR Scanner
        </h1>
        <p className="text-muted-foreground mt-2">
          Scan a ChainRoute QR code or enter the value manually to view shipment details.
        </p>
      </div>

      {/* Manual Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Manual Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qr_value">QR Code Value</Label>
              <div className="flex gap-2">
                <Input
                  id="qr_value"
                  placeholder="CR-123456789"
                  value={manualQR}
                  onChange={(e) => setManualQR(e.target.value)}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !manualQR.trim()}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look Up"}
                </Button>
              </div>
            </div>
            {queryError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Shipment not found. Please check the QR code value.
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Camera Scanner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Camera Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={() => setScannerOpen(true)} 
              className="w-full"
              disabled={isLoading}
            >
              <Camera className="mr-2 h-4 w-4" />
              Open Camera Scanner
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              {"Point your camera at a ChainRoute QR code (format: CR-{number})"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-3">About ChainRoute QR Codes</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Format: <code className="font-mono bg-muted px-1 rounded">CR-&#123;chain_shipment_ref&#125;</code></li>
            <li>Example: <code className="font-mono bg-muted px-1 rounded">CR-123456789</code></li>
            <li>Each shipment gets a unique QR code on creation</li>
            <li>Scanning redirects to the shipment detail page</li>
            <li>No authentication required for public lookup</li>
          </ul>
        </CardContent>
      </Card>

      <QRScanner 
        isOpen={scannerOpen} 
        onClose={() => setScannerOpen(false)} 
        onScan={handleScan} 
      />
    </div>
  );
}