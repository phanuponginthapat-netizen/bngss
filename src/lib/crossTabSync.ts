/**
 * Cross-tab sync — ให้ทุกแท็บของแอปนี้ (บน browser หรือ PWA) แชร์สถานะเดียวกัน
 *
 * ปัญหาที่แก้:
 *  - บางแท็บ session หลุด/หมดอายุ แต่แท็บอื่นยัง valid → แจ้งเตือน real-time ขาดในบางแท็บ
 *  - บางแท็บ WebSocket realtime ถูกตัดตอนพัก → เมื่อกลับมาโฟกัสแท็บอื่น ต้องบังคับให้แท็บที่หลับ reconnect ด้วย
 *  - Sign-in / sign-out ในแท็บหนึ่ง → แท็บอื่นควรอัปเดตตาม
 *  - Online กลับมา → flush offline queue ครั้งเดียว (leader) ไม่ให้ทุกแท็บชนกัน
 *
 * ใช้ BroadcastChannel เป็นหลัก + fallback storage event สำหรับ browser เก่า
 */
import { supabase } from "@/integrations/supabase/client";
import { flush as flushOfflineQueue } from "./offlineQueue";

type Msg =
  | { kind: "auth"; event: string; hasSession: boolean; at: number }
  | { kind: "online"; at: number }
  | { kind: "reconnect-realtime"; at: number }
  | { kind: "ping"; at: number };

const CHANNEL_NAME = "lovable:cross-tab";
const STORAGE_KEY = "lovable:cross-tab:last";
const LEADER_KEY = "lovable:cross-tab:leader";

let bc: BroadcastChannel | null = null;
let installed = false;
let tabId = "";

function post(msg: Msg) {
  try {
    bc?.postMessage(msg);
  } catch { /* ignore */ }
  try {
    // Fallback: storage event fires ใน tab อื่นเมื่อค่าเปลี่ยน
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...msg, from: tabId }));
  } catch { /* ignore */ }
}

function reconnectRealtime() {
  try {
    const rt: any = (supabase as any).realtime;
    if (!rt) return;
    // ปิดแล้วเปิดใหม่ — channel ที่ subscribe อยู่จะ auto rejoin
    if (typeof rt.isConnected === "function" && rt.isConnected()) {
      try { rt.disconnect?.(); } catch {}
    }
    setTimeout(() => { try { rt.connect?.(); } catch {} }, 50);
  } catch { /* ignore */ }
}

async function refreshSessionQuiet() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const expiresAt = (session.expires_at ?? 0) * 1000;
    if (expiresAt - Date.now() < 5 * 60 * 1000) {
      await supabase.auth.refreshSession();
    }
  } catch { /* ignore */ }
}

/** Try to become "leader" tab for online flush (single-writer) */
function tryBecomeLeader(): boolean {
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    const now = Date.now();
    if (raw) {
      const { at } = JSON.parse(raw);
      // ถ้า leader คนก่อนหน้ายังใหม่ (<10s) → ไม่ต้องยึด
      if (now - at < 10_000) return false;
    }
    localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, at: now }));
    return true;
  } catch { return true; }
}

function handleMessage(msg: Msg) {
  if (!msg || typeof msg !== "object") return;
  switch (msg.kind) {
    case "auth": {
      // แท็บอื่นเพิ่ง sign-in/out/refresh — sync session ให้แท็บนี้ตาม
      // (supabase-js อ่าน localStorage อยู่แล้ว แต่บาง event ต้อง trigger refresh)
      if (msg.event === "SIGNED_OUT") {
        // ให้แท็บนี้ signOut ตาม (ไม่ broadcast ต่อ)
        supabase.auth.signOut().catch(() => {});
      } else if (msg.event === "SIGNED_IN" || msg.event === "TOKEN_REFRESHED") {
        refreshSessionQuiet();
        reconnectRealtime();
      }
      break;
    }
    case "online":
    case "reconnect-realtime": {
      refreshSessionQuiet();
      reconnectRealtime();
      break;
    }
    case "ping":
      break;
  }
}

export function installCrossTabSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  tabId = Math.random().toString(36).slice(2);

  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (ev) => handleMessage(ev.data as Msg);
  } catch {
    bc = null;
  }

  // Fallback: cross-tab ผ่าน storage event
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue);
      if (parsed.from === tabId) return;
      handleMessage(parsed);
    } catch { /* ignore */ }
  });

  // Broadcast auth state ให้ทุกแท็บรับรู้พร้อมกัน
  supabase.auth.onAuthStateChange((event, session) => {
    post({ kind: "auth", event, hasSession: !!session, at: Date.now() });
  });

  // เมื่อกลับมา online — leader เดียวเป็นคน flush queue, ทุกแท็บ reconnect
  const onOnline = () => {
    post({ kind: "online", at: Date.now() });
    reconnectRealtime();
    if (tryBecomeLeader()) {
      flushOfflineQueue().catch(() => {});
    }
  };
  window.addEventListener("online", onOnline);

  // Visibility → ปลุก realtime ให้แท็บที่หลับ + บอกแท็บอื่นด้วย
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    refreshSessionQuiet();
    reconnectRealtime();
    post({ kind: "reconnect-realtime", at: Date.now() });
    if (navigator.onLine && tryBecomeLeader()) {
      flushOfflineQueue().catch(() => {});
    }
  });
}
