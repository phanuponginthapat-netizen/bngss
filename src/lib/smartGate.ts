/**
 * Smart Gate bridge — เชื่อมคีออสสแกนใบหน้ากับอุปกรณ์ภายนอก (micro:bit / ESP32 / Arduino)
 *
 * รองรับ 2 ช่องทาง
 *  1) Web Serial  — เสียบ micro:bit ผ่าน USB (Chrome/Edge บน Windows/Linux/ChromeOS)
 *  2) WebSocket   — micro:bit ต่อกับ gateway (Raspberry Pi / ESP32) แล้วส่งผ่าน ws://
 *
 * โปรโตคอลข้อความ (บรรทัดละ 1 คำสั่ง, ปิดท้ายด้วย \n)
 *  จากอุปกรณ์ → ระบบ
 *    TEMP:37.8        อุณหภูมิร่างกาย (°C) จากเซนเซอร์อินฟราเรด เช่น MLX90614
 *    METAL:0..1023    ค่าดิบเซนเซอร์โลหะ (ยิ่งสูง = โลหะมาก)
 *    METAL:ON|OFF     หรือส่งเป็นสถานะสำเร็จรูป
 *    GATE:OPEN|CLOSED สถานะประตู
 *    PING             heartbeat
 *    {"temp":37.8,"metal":120,"gate":"closed"}   (รูปแบบ JSON ก็ได้)
 *  จากระบบ → อุปกรณ์
 *    GATE:OPEN / GATE:CLOSE / BUZZ:ALARM / BUZZ:OK / LED:RED / LED:GREEN
 */

export type GateTransport = "serial" | "ws";

export type SmartGateConfig = {
  enabled: boolean;
  transport: GateTransport;
  wsUrl: string;
  /** เปิดประตูอัตโนมัติเมื่อสแกนใบหน้าสำเร็จ */
  autoOpen: boolean;
  /** ระยะเวลาเปิดประตู (มิลลิวินาที) */
  openMs: number;
  /** อุณหภูมิที่ถือว่าไข้สูง (°C) */
  feverThreshold: number;
  /** ค่าดิบเซนเซอร์โลหะที่ถือว่าพบอาวุธ */
  metalThreshold: number;
  /** บล็อกไม่ให้เปิดประตูเมื่อพบไข้สูง / โลหะ */
  blockOnAlert: boolean;
};

export type SmartGateReading = {
  tempC: number | null;
  metalLevel: number | null;
  metalFlag: boolean;
  gateState: "open" | "closed" | "unknown";
  updatedAt: number;
};

export type SmartGateStatus = "off" | "connecting" | "connected" | "error";

const CFG_KEY = "kiosk_smart_gate_cfg";

export const DEFAULT_GATE_CONFIG: SmartGateConfig = {
  enabled: false,
  transport: "serial",
  wsUrl: "ws://192.168.1.50:8081",
  autoOpen: true,
  openMs: 4000,
  feverThreshold: 37.5,
  metalThreshold: 600,
  blockOnAlert: true,
};

export function loadGateConfig(): SmartGateConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return { ...DEFAULT_GATE_CONFIG };
    return { ...DEFAULT_GATE_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GATE_CONFIG };
  }
}

export function saveGateConfig(cfg: SmartGateConfig) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* noop */ }
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

type Listener = (r: SmartGateReading, status: SmartGateStatus) => void;

/** แปลงข้อความ 1 บรรทัดจากอุปกรณ์ → patch ของค่าที่อ่านได้ */
export function parseDeviceLine(line: string): Partial<SmartGateReading> | null {
  const s = line.trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const j = JSON.parse(s);
      const out: Partial<SmartGateReading> = {};
      if (typeof j.temp === "number") out.tempC = j.temp;
      if (typeof j.tempC === "number") out.tempC = j.tempC;
      if (typeof j.metal === "number") out.metalLevel = j.metal;
      if (typeof j.metal === "boolean") out.metalFlag = j.metal;
      if (typeof j.gate === "string") out.gateState = j.gate.toLowerCase() === "open" ? "open" : "closed";
      return Object.keys(out).length ? out : null;
    } catch { return null; }
  }
  const m = /^([A-Za-z_]+)\s*[:=]\s*(.+)$/.exec(s);
  if (!m) return null;
  const key = m[1].toUpperCase();
  const val = m[2].trim();
  switch (key) {
    case "TEMP":
    case "TEMPERATURE": {
      const n = Number(val);
      return Number.isFinite(n) ? { tempC: n } : null;
    }
    case "METAL":
    case "WEAPON": {
      const up = val.toUpperCase();
      if (up === "ON" || up === "TRUE" || up === "YES") return { metalFlag: true };
      if (up === "OFF" || up === "FALSE" || up === "NO") return { metalFlag: false };
      const n = Number(val);
      return Number.isFinite(n) ? { metalLevel: n } : null;
    }
    case "GATE":
      return { gateState: val.toUpperCase().startsWith("OPEN") ? "open" : "closed" };
    default:
      return null;
  }
}

class SmartGateBridge {
  private listeners = new Set<Listener>();
  private status: SmartGateStatus = "off";
  private reading: SmartGateReading = { tempC: null, metalLevel: null, metalFlag: false, gateState: "unknown", updatedAt: 0 };
  private ws: WebSocket | null = null;
  private port: any = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readAbort: AbortController | null = null;
  private buffer = "";

  getReading() { return this.reading; }
  getStatus() { return this.status; }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.reading, this.status);
    return () => { this.listeners.delete(fn); };
  }

  private emit() {
    for (const fn of this.listeners) { try { fn(this.reading, this.status); } catch { /* noop */ } }
  }

  private setStatus(s: SmartGateStatus) { this.status = s; this.emit(); }

  private ingest(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || "";
    for (const line of lines) {
      const patch = parseDeviceLine(line);
      if (patch) {
        this.reading = { ...this.reading, ...patch, updatedAt: Date.now() };
        this.emit();
      }
    }
  }

  async connect(cfg: SmartGateConfig): Promise<void> {
    await this.disconnect();
    this.setStatus("connecting");
    if (cfg.transport === "ws") {
      await this.connectWs(cfg.wsUrl);
    } else {
      await this.connectSerial();
    }
  }

  private async connectWs(url: string) {
    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.onopen = () => { this.setStatus("connected"); resolve(); };
        ws.onmessage = (e) => this.ingest(typeof e.data === "string" ? e.data + "\n" : "");
        ws.onerror = () => { this.setStatus("error"); reject(new Error("เชื่อมต่อ WebSocket ไม่สำเร็จ")); };
        ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.setStatus("off"); } };
      } catch (e) { this.setStatus("error"); reject(e as Error); }
    });
  }

  private async connectSerial() {
    if (!isWebSerialSupported()) {
      this.setStatus("error");
      throw new Error("เบราว์เซอร์นี้ไม่รองรับ Web Serial (ใช้ Chrome/Edge บนคอมพิวเตอร์)");
    }
    const nav: any = navigator;
    const port = await nav.serial.requestPort();
    await port.open({ baudRate: 115200 });
    this.port = port;
    try {
      this.writer = port.writable?.getWriter() || null;
    } catch { this.writer = null; }
    this.setStatus("connected");
    this.readAbort = new AbortController();
    const signal = this.readAbort.signal;
    (async () => {
      const decoder = new TextDecoder();
      const reader = port.readable?.getReader();
      if (!reader) return;
      try {
        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) this.ingest(decoder.decode(value));
        }
      } catch { /* disconnected */ }
      finally { try { reader.releaseLock(); } catch { /* noop */ } }
      if (this.port === port) this.setStatus("off");
    })();
  }

  async disconnect() {
    try { this.readAbort?.abort(); } catch { /* noop */ }
    this.readAbort = null;
    try { this.writer?.releaseLock(); } catch { /* noop */ }
    this.writer = null;
    if (this.port) { try { await this.port.close(); } catch { /* noop */ } this.port = null; }
    if (this.ws) { try { this.ws.close(); } catch { /* noop */ } this.ws = null; }
    this.buffer = "";
    this.setStatus("off");
  }

  async send(cmd: string) {
    const line = cmd.endsWith("\n") ? cmd : cmd + "\n";
    if (this.ws && this.ws.readyState === WebSocket.OPEN) { this.ws.send(line); return true; }
    if (this.writer) {
      try { await this.writer.write(new TextEncoder().encode(line)); return true; } catch { return false; }
    }
    return false;
  }

  async openGate(openMs: number) {
    const ok = await this.send("GATE:OPEN");
    if (!ok) return false;
    await this.send("LED:GREEN");
    window.setTimeout(() => { this.send("GATE:CLOSE").catch(() => {}); }, Math.max(500, openMs));
    return true;
  }

  async alarm(kind: "fever" | "weapon") {
    await this.send("LED:RED");
    await this.send(kind === "fever" ? "BUZZ:FEVER" : "BUZZ:ALARM");
  }
}

export const smartGate = new SmartGateBridge();

/** ประเมินว่าอนุญาตให้ผ่านประตูได้ไหม จากค่าที่อ่านล่าสุด */
export function evaluateGateSafety(
  reading: SmartGateReading,
  cfg: SmartGateConfig,
): { allow: boolean; reason: "ok" | "fever" | "weapon" | "stale"; detail: string } {
  const fresh = reading.updatedAt > 0 && Date.now() - reading.updatedAt < 15_000;
  if (!fresh) return { allow: true, reason: "stale", detail: "ยังไม่มีค่าจากเซนเซอร์" };
  if (reading.tempC != null && reading.tempC >= cfg.feverThreshold) {
    return { allow: false, reason: "fever", detail: `อุณหภูมิ ${reading.tempC.toFixed(1)}°C (เกณฑ์ ${cfg.feverThreshold}°C)` };
  }
  const metal = reading.metalFlag || (reading.metalLevel != null && reading.metalLevel >= cfg.metalThreshold);
  if (metal) {
    return { allow: false, reason: "weapon", detail: reading.metalLevel != null ? `ค่าโลหะ ${reading.metalLevel} (เกณฑ์ ${cfg.metalThreshold})` : "ตรวจพบโลหะ" };
  }
  return { allow: true, reason: "ok", detail: reading.tempC != null ? `อุณหภูมิ ${reading.tempC.toFixed(1)}°C ปกติ` : "ปกติ" };
}
