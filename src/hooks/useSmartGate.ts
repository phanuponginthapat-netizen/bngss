import { useCallback, useEffect, useRef, useState } from "react";
import {
  smartGate, loadGateConfig, saveGateConfig, evaluateGateSafety,
  type SmartGateConfig, type SmartGateReading, type SmartGateStatus,
} from "@/lib/smartGate";

/**
 * Hook สำหรับควบคุม Smart Gate (ประตูอัตโนมัติ + วัดไข้ + ตรวจโลหะ) ผ่าน micro:bit
 */
export function useSmartGate() {
  const [config, setConfigState] = useState<SmartGateConfig>(() => loadGateConfig());
  const [reading, setReading] = useState<SmartGateReading>(() => smartGate.getReading());
  const [status, setStatus] = useState<SmartGateStatus>(() => smartGate.getStatus());
  const cfgRef = useRef(config);
  const readRef = useRef(reading);

  useEffect(() => { cfgRef.current = config; }, [config]);
  useEffect(() => { readRef.current = reading; }, [reading]);

  useEffect(() => smartGate.subscribe((r, s) => { setReading(r); setStatus(s); }), []);

  const setConfig = useCallback((patch: Partial<SmartGateConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      saveGateConfig(next);
      return next;
    });
  }, []);

  const connect = useCallback(async () => {
    await smartGate.connect(cfgRef.current);
  }, []);

  const disconnect = useCallback(async () => { await smartGate.disconnect(); }, []);

  /** เชื่อมต่อ micro:bit อยู่จริงหรือไม่ (เปิดใช้งาน + สถานะ connected) */
  const isLive = useCallback(() => cfgRef.current.enabled && smartGate.getStatus() === "connected", []);

  /** อุณหภูมิล่าสุด (คืน null ถ้าไม่ได้เชื่อม micro:bit หรือค่าค้างเกิน 15 วินาที) */
  const getLiveTemp = useCallback((): number | null => {
    if (!isLive()) return null;
    const r = readRef.current;
    if (!r.updatedAt || Date.now() - r.updatedAt > 15_000) return null;
    return r.tempC;
  }, [isLive]);

  /** ตรวจความปลอดภัยแล้วเปิดประตู — คืนผลเพื่อให้หน้าเรียกใช้แสดง/พูดได้ */
  const requestPassage = useCallback(async () => {
    const cfg = cfgRef.current;
    const safety = evaluateGateSafety(readRef.current, cfg);
    if (!cfg.enabled || smartGate.getStatus() !== "connected") {
      return { ...safety, opened: false, skipped: true as const };
    }
    // พบโลหะ/อาวุธ → ปิดประตู + เสียงเตือน
    if (safety.reason === "weapon" && cfg.blockOnAlert) {
      await smartGate.alarm("weapon");
      return { ...safety, allow: false, opened: false, skipped: false as const };
    }
    // ไข้สูง → เตือนแต่ยังเปิดประตูให้ผ่าน
    if (safety.reason === "fever") await smartGate.alarm("fever");
    const opened = cfg.autoOpen ? await smartGate.openGate(cfg.openMs) : false;
    return { ...safety, allow: true, opened, skipped: false as const };
  }, []);

  const openManually = useCallback(async () => smartGate.openGate(cfgRef.current.openMs), []);
  const sendCommand = useCallback(async (cmd: string) => smartGate.send(cmd), []);

  return { config, setConfig, reading, status, connect, disconnect, requestPassage, openManually, sendCommand, isLive, getLiveTemp };
}
