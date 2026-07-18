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
      table: "pp5_files",
      buildMessage: (file) => ({
        subjectLabel: file.subject_name || file.file_name,
        term: `ภาคเรียนที่ ${file.semester} / ${file.academic_year}`,
        titlePrefix: "📊 ผลการเรียน",
        referenceType: "pp5_files",
      }),
    });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("announce-pp5-scores error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
