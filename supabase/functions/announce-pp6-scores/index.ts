import { announceGrades } from "../_shared/announceGrades.ts";

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { file_id } = await req.json();
    if (!file_id) throw new Error("file_id required");
    const result = await announceGrades({
      authHeader: req.headers.get("authorization") || "",
      file_id,
      table: "pp6_files",
      buildMessage: (file) => ({
        subjectLabel: file.classroom_name || file.grade_level || "รายงานผลการเรียน",
        term: `ภาคเรียนที่ ${file.semester} / ${file.academic_year}`,
        titlePrefix: "📋 ปพ.6",
        referenceType: "pp6_files",
      }),
    });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("announce-pp6-scores error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
