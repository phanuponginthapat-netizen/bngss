// games-leaderboard: ดึง ranking ของเกม แยกตาม band ได้
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeadersWithHubKey as corsHeaders } from "../_shared/cors.ts";

function gradeToBand(grade?: string | null) {
  if (!grade) return "unknown";
  if (grade.startsWith("อ.")) return "kinder";
  if (["ป.1", "ป.2", "ป.3"].includes(grade)) return "primary_early";
  if (["ป.4", "ป.5", "ป.6"].includes(grade)) return "primary_late";
  if (["ม.1", "ม.2", "ม.3"].includes(grade)) return "secondary_lower";
  if (["ม.4", "ม.5", "ม.6"].includes(grade)) return "secondary_upper";
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const url = new URL(req.url);
    const game_id = url.searchParams.get("game_id");
    const band = url.searchParams.get("band") || "all";
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);
    if (!game_id) return json({ error: "missing_game_id" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: scores = [] } = await admin
      .from("game_hub_scores")
      .select("id, student_id, score, played_at")
      .eq("game_id", game_id)
      .order("score", { ascending: false })
      .limit(500);

    const sids = Array.from(new Set((scores || []).map((s: any) => s.student_id)));
    const { data: students = [] } = sids.length
      ? await admin.from("students").select("id, first_name, last_name, student_code, classrooms!students_classroom_id_fkey(grade_level, name)").in("id", sids)
      : { data: [] };
    const smap: Record<string, any> = {};
    (students || []).forEach((s: any) => { smap[s.id] = s; });

    // Best score per student, filter by band
    const best = new Map<string, any>();
    for (const r of (scores || [])) {
      const stu = smap[r.student_id];
      const g = stu?.classrooms?.grade_level;
      if (band !== "all" && gradeToBand(g) !== band) continue;
      const cur = best.get(r.student_id);
      if (!cur || Number(r.score) > Number(cur.score)) best.set(r.student_id, r);
    }
    const ranking = Array.from(best.values())
      .sort((a, b) => Number(b.score) - Number(a.score))
      .slice(0, limit)
      .map((r, i) => {
        const stu = smap[r.student_id];
        return {
          rank: i + 1,
          student_id: r.student_id,
          display_name: stu ? `${stu.first_name || ""} ${stu.last_name || ""}`.trim() : null,
          student_code: stu?.student_code || null,
          grade_level: stu?.classrooms?.grade_level || null,
          classroom_name: stu?.classrooms?.name || null,
          band: gradeToBand(stu?.classrooms?.grade_level),
          score: Number(r.score),
          played_at: r.played_at,
        };
      });

    return json({ success: true, band, count: ranking.length, ranking });
  } catch (_e) {
    return json({ error: "internal_error" }, 500);
  }
});
