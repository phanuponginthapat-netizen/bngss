import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DoorOpen, Thermometer, ShieldAlert, Plug, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { isWebSerialSupported, evaluateGateSafety } from "@/lib/smartGate";
import type { useSmartGate } from "@/hooks/useSmartGate";

type Props = { gate: ReturnType<typeof useSmartGate> };

/** แผงตั้งค่า Smart Gate — ประตูอัตโนมัติ + ตรวจไข้สูง + ตรวจโลหะ (micro:bit) */
export default function SmartGatePanel({ gate }: Props) {
  const { config, setConfig, reading, status, connect, disconnect, openManually } = gate;
  const safety = evaluateGateSafety(reading, config);
  const fresh = reading.updatedAt > 0 && Date.now() - reading.updatedAt < 15_000;

  return (
    <div className="space-y-2 border-t pt-2">
      <label className="text-xs font-semibold flex items-center gap-2">
        <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ enabled: e.target.checked })} />
        <DoorOpen className="w-3 h-3" /> Smart Gate (ประตู • วัดไข้ • ตรวจโลหะ)
      </label>

      {config.enabled && (
        <>
          <div className="flex gap-1">
            <Button size="sm" variant={config.transport === "serial" ? "default" : "outline"} className="flex-1 h-7 text-[11px]"
              onClick={() => setConfig({ transport: "serial" })}>USB (micro:bit)</Button>
            <Button size="sm" variant={config.transport === "ws" ? "default" : "outline"} className="flex-1 h-7 text-[11px]"
              onClick={() => setConfig({ transport: "ws" })}>WebSocket</Button>
          </div>

          {config.transport === "ws" && (
            <Input value={config.wsUrl} onChange={(e) => setConfig({ wsUrl: e.target.value })}
              placeholder="ws://192.168.1.50:8081" className="text-xs h-8" />
          )}
          {config.transport === "serial" && !isWebSerialSupported() && (
            <p className="text-[10px] text-destructive">เบราว์เซอร์นี้ไม่รองรับ Web Serial — ใช้ Chrome/Edge บนคอมพิวเตอร์ หรือเลือกโหมด WebSocket</p>
          )}

          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1 gap-1"
              disabled={status === "connecting"}
              onClick={async () => {
                try {
                  if (status === "connected") { await disconnect(); toast.info("ตัดการเชื่อมต่ออุปกรณ์แล้ว"); }
                  else { await connect(); toast.success("เชื่อมต่ออุปกรณ์ Smart Gate สำเร็จ"); }
                } catch (e: any) { toast.error(e?.message || "เชื่อมต่ออุปกรณ์ไม่สำเร็จ"); }
              }}>
              {status === "connected" ? <><PlugZap className="w-3 h-3" />ตัดการเชื่อมต่อ</> : <><Plug className="w-3 h-3" />เชื่อมต่ออุปกรณ์</>}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={status !== "connected"}
              onClick={async () => { (await openManually()) ? toast.success("สั่งเปิดประตูแล้ว") : toast.error("ส่งคำสั่งไม่สำเร็จ"); }}>
              <DoorOpen className="w-3 h-3" />เปิดประตู
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Badge className={status === "connected" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-slate-400"}>
              {status === "connected" ? "เชื่อมต่อแล้ว" : status === "connecting" ? "กำลังเชื่อมต่อ…" : status === "error" ? "ผิดพลาด" : "ยังไม่เชื่อมต่อ"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Thermometer className="w-3 h-3" />
              {fresh && reading.tempC != null ? `${reading.tempC.toFixed(1)}°C` : "—"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <ShieldAlert className="w-3 h-3" />
              {fresh ? (reading.metalFlag ? "พบโลหะ" : reading.metalLevel != null ? `โลหะ ${reading.metalLevel}` : "—") : "—"}
            </Badge>
            <Badge variant="outline">ประตู: {reading.gateState === "open" ? "เปิด" : reading.gateState === "closed" ? "ปิด" : "—"}</Badge>
          </div>
          <p className={`text-[10px] ${safety.allow ? "text-muted-foreground" : "text-destructive font-semibold"}`}>
            สถานะความปลอดภัย: {safety.detail}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] space-y-1">
              <span>เกณฑ์ไข้สูง (°C)</span>
              <Input type="number" step="0.1" className="h-7 text-xs" value={config.feverThreshold}
                onChange={(e) => setConfig({ feverThreshold: Number(e.target.value) || 37.5 })} />
            </label>
            <label className="text-[10px] space-y-1">
              <span>เกณฑ์โลหะ (ค่าดิบ)</span>
              <Input type="number" className="h-7 text-xs" value={config.metalThreshold}
                onChange={(e) => setConfig({ metalThreshold: Number(e.target.value) || 600 })} />
            </label>
            <label className="text-[10px] space-y-1">
              <span>เวลาเปิดประตู (ms)</span>
              <Input type="number" className="h-7 text-xs" value={config.openMs}
                onChange={(e) => setConfig({ openMs: Number(e.target.value) || 4000 })} />
            </label>
            <div className="space-y-1 pt-4">
              <label className="text-[10px] flex items-center gap-1">
                <input type="checkbox" checked={config.autoOpen} onChange={(e) => setConfig({ autoOpen: e.target.checked })} />
                เปิดประตูอัตโนมัติเมื่อสแกนผ่าน
              </label>
              <label className="text-[10px] flex items-center gap-1">
                <input type="checkbox" checked={config.blockOnAlert} onChange={(e) => setConfig({ blockOnAlert: e.target.checked })} />
                บล็อกเมื่อไข้สูง/พบโลหะ
              </label>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground leading-snug">
            อุปกรณ์ส่งข้อความบรรทัดละคำสั่ง: <code>TEMP:37.8</code>, <code>METAL:640</code>, <code>GATE:OPEN</code> —
            ระบบส่งกลับ <code>GATE:OPEN/CLOSE</code>, <code>BUZZ:ALARM</code>, <code>LED:RED/GREEN</code>
            (ดูตัวอย่างโค้ด micro:bit ใน <code>docs/SMART-GATE-MICROBIT.md</code>)
          </p>
        </>
      )}
    </div>
  );
}
