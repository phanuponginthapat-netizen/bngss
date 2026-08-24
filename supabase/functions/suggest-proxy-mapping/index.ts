// Suggests a mapping from ad-hoc "proxy" subjects (created while importing a
// timetable) to real curriculum subjects. Uses AI when a provider is
// configured, and always falls back to deterministic string similarity.
import { corsHeaders } from "../_shared/cors.ts";
import { aiCall } from "../_shared/aiCall.ts";

type Subject = { id: string; code?: string | null; name_th?: string | null; grade_level?: string | number | null };

const norm = (s: unknown) =>
  String(s ?? "").toLowerCase().replace(/[\s\-_.()]/g, "").replace(/ที่\d+$/, "");

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const bigrams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((g) => { if (B.has(g)) hit++; });
  return (2 * hit) / (A.size + B.size);
}

function heuristicMap(proxies: Subject[], real: Subject[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const p of proxies) {
    let best: { id: string; score: number } | null = null;
    for (const r of real) {
      const codeScore = p.code && r.code ? similarity(norm(p.code), norm(r.code)) : 0;
      const nameScore = similarity(norm(p.name_th), norm(r.name_th));
      let score = Math.max(codeScore * 1.05, nameScore);
      if (p.grade_level && r.grade_level && String(p.grade_level) === String(r.grade_level)) score += 0.08;
      if (!best || score > best.score) best = { id: r.id, score };
    }
    out[p.id] = best && best.score >= 0.55 ? best.id : null;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { proxies = [], real = [] } = await req.json().catch(() => ({}));
    if (!Array.isArray(proxies) || !Array.isArray(real) || proxies.length === 0 || real.length === 0) {
      return json({ suggestions: {} });
    }

    const fallback = heuristicMap(proxies, real);

    try {
      const result = await aiCall({
        functionName: "suggest-proxy-mapping",
        json: true,
        temperature: 0,
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content:
              "คุณคือผู้ช่วยจับคู่รายวิชาของโรงเรียนไทย จับคู่วิชาชั่วคราว (proxy) กับวิชาในหลักสูตรจริงที่ตรงที่สุด " +
              'ตอบเป็น JSON เท่านั้น รูปแบบ {"suggestions": {"<proxy_id>": "<real_id> หรือ null"}} ห้ามเดาถ้าไม่มั่นใจให้ตอบ null',
          },
          {
            role: "user",
            content: JSON.stringify({
              proxies: proxies.map((p: Subject) => ({ id: p.id, code: p.code, name: p.name_th, grade: p.grade_level })),
              real: real.map((r: Subject) => ({ id: r.id, code: r.code, name: r.name_th, grade: r.grade_level })),
            }),
          },
        ],
      });
      const text = String(result?.content ?? "");
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      const sugg = parsed?.suggestions;
      if (sugg && typeof sugg === "object") {
        const realIds = new Set(real.map((r: Subject) => r.id));
        const merged: Record<string, string | null> = { ...fallback };
        for (const p of proxies as Subject[]) {
          const v = sugg[p.id];
          if (typeof v === "string" && realIds.has(v)) merged[p.id] = v;
        }
        return json({ suggestions: merged, source: "ai" });
      }
    } catch (_e) {
      // AI unavailable — heuristic result below is still useful
    }

    return json({ suggestions: fallback, source: "heuristic" });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
