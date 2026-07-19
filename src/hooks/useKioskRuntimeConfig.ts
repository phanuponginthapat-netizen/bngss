import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callLocalCtl } from "@/lib/monitorSignal";
import { toast } from "sonner";

export type KioskRuntimeConfig = {
  mode?: "door" | "student";
  kioskUrl?: string;
  kioskUser?: string;
  wifiSsid?: string;
  wifiPass?: string;
  enableDailyReboot?: boolean;
  rebootTime?: string; // "HH:MM"
  idleLogoutMin?: number;
  idleShutdownMin?: number;
  powerOn?: string;
  powerOff?: string;
  exitPin?: string;
  updated_at?: string;
};

const SETTING_KEY = "kiosk_config";

/**
 * โหลด kiosk_config จาก school_settings + subscribe realtime
 * แล้ว apply ค่าที่ปรับสดได้:
 *   - idleLogoutMin  → auto sign-out เมื่อไม่ใช้งาน
 *   - rebootTime     → เมื่อเวลาตรง → callLocalCtl("/reboot")
 *
 * ใช้บนหน้า Agent (เครื่องนักเรียน) เพื่อให้แก้ค่าจากหน้า Kiosk Setup
 * แล้ว sync ลงเครื่องภายใน ~1 นาที โดยไม่ต้องรัน setup script ใหม่
 */
export function useKioskRuntimeConfig(enabled: boolean = true) {
  const [config, setConfig] = useState<KioskRuntimeConfig | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const lastRebootDateRef = useRef<string | null>(null);

  // load + realtime subscribe
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const parse = (raw: any): KioskRuntimeConfig | null => {
      if (!raw) return null;
      let v: any = raw;
      if (typeof v === "string") {
        try { v = JSON.parse(v); } catch { return null; }
      }
      return (v && typeof v === "object") ? (v as KioskRuntimeConfig) : null;
    };

    (async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();
      if (!cancelled) setConfig(parse((data as any)?.setting_value));
    })();

    const ch = supabase
      .channel(`kiosk-config-sync`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "school_settings", filter: `setting_key=eq.${SETTING_KEY}` },
        (payload: any) => {
          const next = parse(payload.new?.setting_value ?? payload.old?.setting_value);
          if (next) {
            setConfig(next);
            toast("การตั้งค่า Kiosk อัปเดตแล้ว");
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [enabled]);

  // idle logout
  useEffect(() => {
    if (!enabled) return;
    const min = Number(config?.idleLogoutMin) || 0;
    if (!min || min <= 0) return;

    const ms = min * 60 * 1000;
    const reset = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(async () => {
        toast("ไม่มีการใช้งาน — ออกจากระบบอัตโนมัติ");
        await supabase.auth.signOut().catch(() => {});
        callLocalCtl("/logout").catch(() => {});
        setTimeout(() => { window.location.href = "/"; }, 400);
      }, ms);
    };
    const events = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [enabled, config?.idleLogoutMin]);

  // scheduled reboot (browser-side trigger to local daemon)
  useEffect(() => {
    if (!enabled) return;
    if (!config?.enableDailyReboot) return;
    const t = (config.rebootTime || "").trim();
    if (!/^\d{2}:\d{2}$/.test(t)) return;

    const check = async () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const dayKey = bkkDateISO(now);
      if (hhmm === t && lastRebootDateRef.current !== dayKey) {
        lastRebootDateRef.current = dayKey;
        const ok = await callLocalCtl("/reboot").catch(() => false);
        if (ok) toast("รีบูตอัตโนมัติตามตารางเวลา");
      }
    };
    const iv = window.setInterval(check, 30_000);
    check();
    return () => window.clearInterval(iv);
  }, [enabled, config?.enableDailyReboot, config?.rebootTime]);

  return config;
}
