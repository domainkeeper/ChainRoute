import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { Download, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

interface QRDisplayProps {
  value: string;
  size?: number;
  label?: string;
  showValue?: boolean;
}

export function QRDisplay({ value, size = 200, label, showValue = true }: QRDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const svg = document.querySelector(`[data-qr-value="${value}"] svg`);
    if (svg && ctx) {
      const img = new Image();
      img.onload = () => {
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0);
        const link = document.createElement("a");
        link.download = `qrcode-${value}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      };
      img.src = "data:image/svg+xml;base64," + btoa(svg.outerHTML);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <h3 className="text-lg font-semibold">{label}</h3>}
      <div className="relative" data-qr-value={value}>
        <QRCodeSVG value={value} size={size} level="M" />
      </div>
      {showValue && (
        <div className="flex items-center gap-2 text-sm">
          <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1 text-center break-all">
            {value}
          </code>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
