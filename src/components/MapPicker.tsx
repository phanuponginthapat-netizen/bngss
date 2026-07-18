import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Locate, Crosshair, Navigation } from "lucide-react";
import { toast } from "sonner";

// Fix default marker icons (Leaflet expects asset URLs from CDN)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Pulsing blue dot for "current GPS position"
const liveDotIcon = L.divIcon({
  className: "live-gps-dot",
  html: `<div style="position:relative;width:18px;height:18px;">
    <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(59,130,246,0.35);animation:gpsPulse 1.8s ease-out infinite;"></span>
    <span style="position:absolute;inset:4px;border-radius:9999px;background:#3b82f6;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.2);"></span>
  </div>
  <style>@keyframes gpsPulse{0%{transform:scale(0.6);opacity:0.9}100%{transform:scale(2.4);opacity:0}}</style>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  radius?: number; // meters, draws a circle
  onChange: (lat: number, lng: number) => void;
  height?: number;
}

const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018]; // Bangkok

const MapPicker = ({ lat, lng, radius = 200, onChange, height = 360 }: MapPickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const liveMarkerRef = useRef<L.Marker | null>(null);
  const liveAccuracyRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [livePos, setLivePos] = useState<{ lat: number; lng: number; accuracy: number; ts: number } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const initialCenter = useMemo<[number, number]>(() => {
    if (lat != null && lng != null) return [lat, lng];
    return DEFAULT_CENTER;
  }, []); // intentionally only on mount

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: lat != null && lng != null ? 17 : 12,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onChange(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      liveMarkerRef.current = null;
      liveAccuracyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker + circle with lat/lng/radius
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null) {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }
      return;
    }
    const pos: [number, number] = [lat, lng];
    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos, { icon: defaultIcon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const ll = markerRef.current!.getLatLng();
        onChange(+ll.lat.toFixed(6), +ll.lng.toFixed(6));
      });
    }
    if (circleRef.current) {
      circleRef.current.setLatLng(pos);
      circleRef.current.setRadius(radius);
    } else {
      circleRef.current = L.circle(pos, {
        radius,
        color: "hsl(var(--primary))",
        fillColor: "hsl(var(--primary))",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
    }
  }, [lat, lng, radius, onChange]);

  // Watch live GPS position (continuous)
  useEffect(() => {
    if (!navigator.geolocation) {
      setLiveError("เบราว์เซอร์ไม่รองรับ GPS");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveError(null);
        setLivePos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: pos.timestamp,
        });
      },
      (err) => {
        setLiveError(err.code === 1 ? "ผู้ใช้ปฏิเสธสิทธิ์ตำแหน่ง" : "อ่านตำแหน่งไม่ได้");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    watchIdRef.current = id;
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Render live position marker + accuracy circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !livePos) return;
    const pos: [number, number] = [livePos.lat, livePos.lng];
    if (liveMarkerRef.current) {
      liveMarkerRef.current.setLatLng(pos);
    } else {
      liveMarkerRef.current = L.marker(pos, { icon: liveDotIcon, interactive: true, zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip("ตำแหน่งปัจจุบันของคุณ", { direction: "top", offset: [0, -8] });
    }
    if (liveAccuracyRef.current) {
      liveAccuracyRef.current.setLatLng(pos);
      liveAccuracyRef.current.setRadius(livePos.accuracy);
    } else {
      liveAccuracyRef.current = L.circle(pos, {
        radius: livePos.accuracy,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        weight: 1,
        dashArray: "4 4",
      }).addTo(map);
    }
  }, [livePos]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("เบราว์เซอร์นี้ไม่รองรับ GPS");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = +pos.coords.latitude.toFixed(6);
        const ln = +pos.coords.longitude.toFixed(6);
        onChange(la, ln);
        mapRef.current?.setView([la, ln], 18);
      },
      () => toast.error("ไม่สามารถดึงตำแหน่งได้ กรุณาเปิด Location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const centerOnLive = () => {
    if (!livePos) {
      toast.error("ยังไม่ได้รับสัญญาณ GPS");
      return;
    }
    mapRef.current?.setView([livePos.lat, livePos.lng], 18);
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(search)}`;
      const res = await fetch(url, { headers: { "Accept-Language": "th,en" } });
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        toast.error("ไม่พบสถานที่");
        return;
      }
      const la = +parseFloat(data[0].lat).toFixed(6);
      const ln = +parseFloat(data[0].lon).toFixed(6);
      onChange(la, ln);
      mapRef.current?.setView([la, ln], 17);
    } catch (e: any) {
      toast.error("ค้นหาไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="ค้นหาสถานที่ / ที่อยู่ เช่น โรงเรียน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } }}
          />
          <Button type="button" variant="outline" size="icon" onClick={doSearch} disabled={searching} title="ค้นหา">
            <Search className="w-4 h-4" />
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={useMyLocation} className="gap-2">
          <Locate className="w-4 h-4" />ใช้ตำแหน่งฉัน
        </Button>
        <Button type="button" variant="outline" onClick={centerOnLive} className="gap-2" title="ไปที่จุด GPS ปัจจุบัน">
          <Crosshair className="w-4 h-4" />ไปจุด GPS
        </Button>
      </div>

      {/* Live GPS status */}
      <div className="flex items-center flex-wrap gap-2 text-xs">
        {livePos ? (
          <>
            <Badge variant="outline" className="gap-1 font-mono">
              <Navigation className="w-3 h-3 text-info" />
              {livePos.lat.toFixed(6)}, {livePos.lng.toFixed(6)}
            </Badge>
            <Badge variant="outline" className="text-info border-info/30">
              ±{Math.round(livePos.accuracy)} ม.
            </Badge>
            {lat != null && lng != null && (() => {
              const R = 6371000;
              const toRad = (d: number) => (d * Math.PI) / 180;
              const dLat = toRad(livePos.lat - lat);
              const dLng = toRad(livePos.lng - lng);
              const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat)) * Math.cos(toRad(livePos.lat)) * Math.sin(dLng / 2) ** 2;
              const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const inRange = d <= radius;
              return (
                <Badge variant="outline" className={inRange ? "text-success border-success/30" : "text-warning border-warning/30"}>
                  ห่างจากหมุด {d < 1000 ? `${Math.round(d)} ม.` : `${(d / 1000).toFixed(2)} กม.`}
                  {inRange ? " · ในรัศมี" : " · นอกรัศมี"}
                </Badge>
              );
            })()}
          </>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {liveError ?? "กำลังรอสัญญาณ GPS..."}
          </Badge>
        )}
      </div>

      <div
        ref={containerRef}
        style={{ height }}
        className="w-full rounded-xl overflow-hidden border z-0"
      />
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        แตะที่แผนที่เพื่อปักหมุด หรือลากหมุดเพื่อปรับตำแหน่ง · จุดน้ำเงินกระพริบคือตำแหน่ง GPS ปัจจุบัน (วงประ = ค่าความแม่นยำ)
      </p>
    </div>
  );
};

export default MapPicker;
