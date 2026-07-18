import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Crosshair, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSchoolGeofence, calcDistanceMeters } from "@/hooks/useSchoolGeofence";

const userIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px rgba(59,130,246,.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/**
 * Live GPS map: ตัวช่วย "วอร์ม GPS" ก่อนสแกนหน้าหรือลงเวลา
 * - แสดงตำแหน่งโรงเรียน (รัศมีอนุญาต) เทียบกับตำแหน่งปัจจุบัน
 * - watchPosition ต่อเนื่อง — ทุกครั้งที่ได้ fix ใหม่จะอัปเดต และ accuracy จะค่อยๆ ดีขึ้น
 *   เพราะ OS เริ่มใช้ GPS sensor แทน WiFi positioning
 */
const GpsTrackingCard = () => {
  const geo = useSchoolGeofence();
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = geo.configured ? [geo.lat, geo.lng] : [13.7563, 100.5018];
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView(center, 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.configured, geo.lat, geo.lng, geo.radius]);

  // Watch position
  useEffect(() => {
    if (!navigator.geolocation) { setErr("เบราว์เซอร์ไม่รองรับ GPS"); return; }
    setWatching(true);
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? 9999 };
        setPos(c);
        setErr(null);
        const map = mapRef.current; if (!map) return;
        if (userMarkerRef.current) userMarkerRef.current.setLatLng([c.lat, c.lng]);
        else userMarkerRef.current = L.marker([c.lat, c.lng], { icon: userIcon }).addTo(map).bindPopup("คุณอยู่ที่นี่");
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([c.lat, c.lng]);
          accuracyCircleRef.current.setRadius(c.accuracy);
        } else {
          accuracyCircleRef.current = L.circle([c.lat, c.lng], { radius: c.accuracy, color: "#3b82f6", fillOpacity: 0.1, weight: 1 }).addTo(map);
        }
        map.panTo([c.lat, c.lng], { animate: true, duration: 0.5 });
      },
      (e) => setErr(e.message || "อ่านตำแหน่งไม่ได้"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
    return () => { navigator.geolocation.clearWatch(id); setWatching(false); };
  }, []);

  const distance = pos && geo.configured ? calcDistanceMeters(pos.lat, pos.lng, geo.lat, geo.lng) : null;
  const effective = distance != null && pos ? Math.max(0, distance - pos.accuracy) : null;
  const inRange = effective != null ? effective <= geo.radius : null;

  const recenter = () => {
    const map = mapRef.current;
    if (map && pos) map.setView([pos.lat, pos.lng], 18);
    else if (map && geo.configured) map.setView([geo.lat, geo.lng], 17);
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            ตำแหน่งปัจจุบัน (วอร์ม GPS)
          </span>
          <div className="flex items-center gap-2">
            {watching && <Badge variant="secondary" className="text-[10px]">กำลังติดตาม</Badge>}
            <Button size="sm" variant="ghost" onClick={recenter} className="h-7 px-2">
              <Crosshair className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div ref={containerRef} style={{ height: 260, borderRadius: 12, overflow: "hidden" }} className="border relative z-0 isolate [&_.leaflet-top]:!z-[400] [&_.leaflet-bottom]:!z-[400] [&_.leaflet-control]:!z-[400]" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!geo.configured && <Badge variant="outline">ยังไม่ได้ตั้งพิกัดโรงเรียน</Badge>}
          {err && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{err}</Badge>
          )}
          {pos && (
            <>
              <Badge variant="outline">ความแม่นยำ ±{Math.round(pos.accuracy)} ม.</Badge>
              {distance != null && <Badge variant="outline">ระยะห่าง {Math.round(distance)} ม.</Badge>}
              {inRange === true && (
                <Badge className="bg-success/15 text-success dark:text-success gap-1">
                  <CheckCircle2 className="w-3 h-3" /> อยู่ในพื้นที่
                </Badge>
              )}
              {inRange === false && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" /> นอกพื้นที่
                </Badge>
              )}
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          💡 เปิดหน้านี้ค้างไว้สัก 5-10 วินาทีก่อนสแกน/ลงเวลา — accuracy จะค่อยๆ ดีขึ้นเพราะระบบเริ่มใช้ GPS sensor แทน WiFi
        </p>
      </CardContent>
    </Card>
  );
};

export default GpsTrackingCard;
