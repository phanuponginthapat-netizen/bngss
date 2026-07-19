import { bkkDateISO } from "../_shared/thaiDate.ts";
// Shared LINE bot session store + DOB normalizer.
// Sessions live in `line_sessions` table (line_user_id UNIQUE, expires_at timestamptz).

export async function getSession(sb: any, lineUserId: string) {
  try { await sb.rpc("cleanup_expired_line_sessions"); } catch { /* ignore */ }
  const { data } = await sb.from("line_sessions").select("*").eq("line_user_id", lineUserId).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await sb.from("line_sessions").delete().eq("line_user_id", lineUserId);
    return null;
  }
  return data;
}

export async function setSession(sb: any, lineUserId: string, intent: string, step: string, payload: any) {
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await sb.from("line_sessions").upsert(
    { line_user_id: lineUserId, intent, step, payload, expires_at },
    { onConflict: "line_user_id" },
  );
  if (error) { console.error("[setSession] failed", { uid: lineUserId, intent, step, error }); throw error; }
}

export async function clearSession(sb: any, lineUserId: string) {
  const { error } = await sb.from("line_sessions").delete().eq("line_user_id", lineUserId);
  if (error) throw error;
}

/** Normalize Thai/Gregorian DOB inputs into ISO `YYYY-MM-DD` (Gregorian). */
export function normalizeDob(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  const ddmmyyyy = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (ddmmyyyy) {
    const d = +ddmmyyyy[1], m = +ddmmyyyy[2], y = +ddmmyyyy[3];
    const yy = y > 2400 ? y - 543 : y;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    const yy = y > 2400 ? y - 543 : y;
    return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const d = +dmy[1], m = +dmy[2], y = +dmy[3];
    const yy = y > 2400 ? y - 543 : y;
    if (m < 1 || m > 12) return null;
    return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

export const dobMatches = (stored: any, given: string) => {
  const n = normalizeDob(given);
  return !!n && !!stored && String(stored).slice(0, 10) === n;
};

/** ISO date string (YYYY-MM-DD) for today + `days`. */
export function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return bkkDateISO(d);
}
