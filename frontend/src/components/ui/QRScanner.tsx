import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { X, Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QRScannerProps {
  onScan: (qrValue: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function QRScanner({ onScan, onClose, isOpen }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      return;
    }

    const startScanning = async () => {
      if (!videoRef.current) return;
      
      try {
        scannerRef.current = new Html5Qrcode("qr-reader");
        await scannerRef.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (qrValue) => {
            onScan(qrValue);
            stopScanning();
            onClose();
          },
          () => {
            // Ignore scan errors
          }
        );
        setScanning(true);
        setError(null);
      } catch (err) {
        setError("Failed to start camera. Please ensure camera permissions are granted.");
        console.error("QR Scanner error:", err);
      }
    };

    startScanning();

    return () => {
      stopScanning();
    };
  }, [isOpen, onScan, onClose]);

  const stopScanning = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
      setScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={cn("relative w-full max-w-md bg-white dark:bg-gray-900 rounded-lg shadow-xl")}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Scan QR Code</h3>
          <Button variant="ghost" size="icon" onClick={() => { stopScanning(); onClose(); }}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          <div id="qr-reader" ref={videoRef} className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden" />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
          {"Point camera at a ChainRoute QR code (format: CR-{number})"}
        </div>
      </div>
    </div>
  );
}