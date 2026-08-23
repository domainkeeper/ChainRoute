import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { MapPin, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import L from "leaflet";
import type { Checkpoint, Shipment } from "@/types/api";

// Fix for Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  type: "origin" | "destination" | "checkpoint";
  note?: string;
  date?: string;
}

function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  // In a real app, you'd use a geocoding service like Nominatim, Mapbox, or Google Maps
  // For demo purposes, we'll use a simple mock or return null
  // This is a placeholder - in production you'd call a real geocoding API
  return Promise.resolve(null);
}

function getMarkerIcon(type: MapMarker["type"]) {
  const colors = {
    origin: "green",
    destination: "red",
    checkpoint: "blue",
  };
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${colors[type]}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

interface MapViewProps {
  shipment: Shipment;
  checkpoints: Checkpoint[];
  className?: string;
  height?: string;
  readOnly?: boolean;
}

export function MapView({ shipment, checkpoints, className, height = "400px", readOnly = true }: MapViewProps) {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [center, setCenter] = useState<[number, number]>([20, 0]);
  const [zoom, setZoom] = useState(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For demo, we'll use mock coordinates based on location names
    // In production, you'd geocode the actual addresses
    const mockCoordinates: Record<string, [number, number]> = {
      "shanghai": [31.2304, 121.4737],
      "los angeles": [34.0522, -118.2437],
      "singapore": [1.3521, 103.8198],
      "rotterdam": [51.9244, 4.4777],
      "hamburg": [53.5511, 9.9937],
      "busan": [35.1796, 129.0756],
      "new york": [40.7128, -74.0060],
      "port of shanghai": [31.2304, 121.4737],
      "port of los angeles": [33.7361, -118.2922],
      "warehouse": [31.2304, 121.4737],
    };

    const findCoords = (location: string): [number, number] | null => {
      const lower = location.toLowerCase();
      for (const [key, coords] of Object.entries(mockCoordinates)) {
        if (lower.includes(key)) return coords;
      }
      // Default fallback
      return [20, 0];
    };

    const originCoords = findCoords(shipment.origin) || [20, 0];
    const destCoords = findCoords(shipment.destination) || [20, 0];

    const newMarkers: MapMarker[] = [
      { lat: originCoords[0], lng: originCoords[1], label: `Origin: ${shipment.origin}`, type: "origin" },
      { lat: destCoords[0], lng: destCoords[1], label: `Destination: ${shipment.destination}`, type: "destination" },
      ...checkpoints.map((cp) => {
        const coords = findCoords(cp.location) || [20, 0];
        return {
          lat: coords[0],
          lng: coords[1],
          label: `Checkpoint: ${cp.location}`,
          type: "checkpoint" as const,
          note: cp.note || undefined,
          date: cp.created_at,
        };
      }),
    ];

    setMarkers(newMarkers);

    // Calculate center and zoom to fit all markers
    if (newMarkers.length > 0) {
      const lats = newMarkers.map((m) => m.lat);
      const lngs = newMarkers.map((m) => m.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setCenter([(minLat + maxLat) / 2, (minLng + maxLng) / 2]);
      // Simple zoom calculation
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;
      const maxDiff = Math.max(latDiff, lngDiff);
      let calculatedZoom = 2;
      if (maxDiff > 0) {
        calculatedZoom = Math.min(12, Math.max(2, Math.floor(10 - Math.log2(maxDiff))));
      }
      setZoom(calculatedZoom);
    }
    setLoading(false);
  }, [shipment.origin, shipment.destination, checkpoints]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-lg", className)} style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={!readOnly}
      className={cn("rounded-lg", className)}
      style={{ height, width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker, index) => (
        <Marker key={index} position={[marker.lat, marker.lng]} icon={getMarkerIcon(marker.type)}>
          <Popup>
            <div className="p-1">
              <p className="font-medium">{marker.label}</p>
              {marker.note && <p className="text-sm text-muted-foreground">{marker.note}</p>}
              {marker.date && <p className="text-xs text-muted-foreground">{new Date(marker.date).toLocaleString()}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
