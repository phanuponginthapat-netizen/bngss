/**
 * เก็บค่าสถานะเครื่อง Kiosk (แบตเตอรี่ / หน่วยความจำ / ความหน่วงเครือข่าย)
 * - แบตเตอรี่: อ่านจาก local control daemon ของ Linux kiosk (127.0.0.1:9998/battery) ก่อน
 *   ถ้าไม่มี ค่อย fallback ไปที่ Battery Status API ของเบราว์เซอร์
 */

export type KioskTelemetry = {
  battery_percent: number | null;
  battery_charging: boolean | null;
  battery_status: string | null;
  memory_used_mb: number | null;
  latency_ms: number | null;
};

const LOCAL_CTL = "http://127.0.0.1:9998/battery";

async function readLocalBattery(): Promise<Partial<KioskTelemetry> | null> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(LOCAL_CTL, { signal: ctrl.signal, cache: "no-store" });
    window.clearTimeout(t);
    if (!res.ok) return null;
    const j: any = await res.json();
    const pct = Number(j?.capacity ?? j?.percent);
    if (!Number.isFinite(pct)) return null;
    const st = String(j?.status ?? "").toLowerCase();
    return {
      battery_percent: Math.max(0, Math.min(100, Math.round(pct))),
      battery_charging: typeof j?.charging === "boolean" ? j.charging : st.includes("charg"),
      battery_status: j?.status ? String(j.status) : null,
    };
  } catch {
    return null;
  }
}

async function readBrowserBattery(): Promise<Partial<KioskTelemetry> | null> {
  try {
    const getBattery = (navigator as any)?.getBattery;
    if (typeof getBattery !== "function") return null;
    const b = await getBattery.call(navigator);
    if (!b || typeof b.level !== "number") return null;
    return {
      battery_percent: Math.round(b.level * 100),
      battery_charging: !!b.charging,
      battery_status: b.charging ? "Charging" : "Discharging",
    };
  } catch {
    return null;
  }
}

export async function collectKioskTelemetry(pingUrl?: string): Promise<KioskTelemetry> {
  const out: KioskTelemetry = {
    battery_percent: null,
    battery_charging: null,
    battery_status: null,
    memory_used_mb: null,
    latency_ms: null,
  };

  const batt = (await readLocalBattery()) ?? (await readBrowserBattery());
  if (batt) Object.assign(out, batt);

  try {
    const mem = (performance as any)?.memory?.usedJSHeapSize;
    if (Number.isFinite(mem)) out.memory_used_mb = Math.round(mem / 1048576);
  } catch { /* ignore */ }

  if (pingUrl) {
    try {
      const t0 = performance.now();
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 4000);
      await fetch(pingUrl, { method: "HEAD", signal: ctrl.signal, cache: "no-store", mode: "no-cors" });
      window.clearTimeout(t);
      out.latency_ms = Math.round(performance.now() - t0);
    } catch { /* ignore */ }
  }

  return out;
}
