// Analyze PDF template: try AcroForm fields first (deterministic, no AI), then fallback to AI providers.
// Saves the resulting field_map back to print_templates row.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { getSecret } from "../_shared/getSecret.ts";
import { secretKeys } from "../_shared/secretKeys.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { todayBangkokISO } from "../_shared/thaiDate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

const SYSTEM_PROMPT = `คุณคือผู้เชี่ยวชาญฟอร์มราชการไทย (สพฐ./กสศ./ก.พ.) วิเคราะห์ PDF ที่ผู้ใช้อัปโหลด แล้วระบุ "ทุกช่อง" ที่ต้องกรอก/ติ๊ก/ลงนาม

คืน JSON object เท่านั้น รูปแบบ:
{
  "fields": [
    {
      "key": "snake_case ภาษาอังกฤษสั้นๆ ห้ามซ้ำ",
      "label": "ป้ายชื่อภาษาไทยตามที่ปรากฏในฟอร์ม",
      "type": "text" | "checkbox" | "radio" | "date" | "signature" | "number" | "longtext",
      "group": "ชื่อหัวข้อ/ส่วนที่ฟิลด์นี้อยู่ เช่น 'ข้อมูลนักเรียน', 'สถานะครัวเรือน'",
      "page": <เลขหน้าเริ่มจาก 1>,
      "bbox": [ymin, xmin, ymax, xmax],  // พิกัด normalized 0-1000 ตาม Gemini bounding box convention เท่านั้น
      "options": ["ตัวเลือก1","ตัวเลือก2"],   // เฉพาะ radio/checkbox group
      "data_hint": "เดาแหล่งข้อมูล เช่น students.first_name, students.last_name, schools.name, manual"
    }
  ]
}

ข้อกำหนด:
- ใช้พิกัด [ymin, xmin, ymax, xmax] ในสเกล 0-1000 เท่านั้น ห้ามสลับเป็น [x1,y1,x2,y2]
- จับ checkbox แต่ละช่องแยกกัน (1 ช่อง = 1 field type=checkbox)
- ถ้าเป็นช่องเลือกแบบ "เลือก 1 จากหลาย" ให้ระบุตำแหน่งช่องวงกลม/สี่เหลี่ยมแต่ละตัวเลือกแยกกัน เพื่อให้ติ๊กได้ตรงตำแหน่งจริง
- ลายเซ็น → type=signature
- ห้ามใส่ markdown หรือคำอธิบาย ตอบ JSON ล้วน`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let templateId: string | undefined;

  try {
    const { template_id } = await req.json();
    templateId = template_id;
    if (!templateId) return json({ error: "template_id required" }, 400);

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tpl, error: tplErr } = await supa
      .from("print_templates")
      .select("id, source_pdf_path")
      .eq("id", templateId)
      .single();
    if (tplErr || !tpl) return json({ error: "template not found" }, 404);
    if (!tpl.source_pdf_path) return json({ error: "template has no source_pdf_path" }, 400);

    await supa.from("print_templates").update({
      analyze_status: "running",
      analyze_error: null,
    }).eq("id", templateId);

    // Download PDF from storage
    const { data: file, error: dlErr } = await supa.storage
      .from("print-templates")
      .download(tpl.source_pdf_path);
    if (dlErr || !file) throw new Error(`download failed: ${dlErr?.message}`);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const b64 = base64Encode(bytes);

    // === STEP 1: Try AcroForm extraction (deterministic, no AI, no credits) ===
    try {
      const acroFields = await extractAcroFormFields(bytes);
      if (acroFields.length > 0) {
        await supa.from("print_templates").update({
          field_map: acroFields,
          analyze_status: "done",
          analyzed_at: new Date().toISOString(),
          analyze_error: null,
        }).eq("id", templateId);
        return json({ ok: true, fields_count: acroFields.length, fields: acroFields, source: "acroform" });
      }
    } catch (e) {
      console.warn("AcroForm extraction failed, falling back to AI:", e);
    }

    // === STEP 2: AI fallback (OpenAI → Gemini → OpenAI-compatible → Lovable) ===
    await resetPoolState(supa, "openai");
    await resetPoolState(supa, "gemini");
    await resetPoolState(supa, "openrouter");
    await resetPoolState(supa, "groq");

    const openAiCandidates = await loadOpenAICandidates(supa);
    const geminiCandidates = await loadGeminiCandidates(supa);
    const compatibleCandidates = await loadOpenAICompatibleCandidates(supa);

    let aiResp: Response | null = null;
    let usedKeyId: string | null = null;
    let usedKeyLabel = "";
    let lastStatus = 0;
    let lastBody = "";
    const errors: string[] = [];

    for (const c of openAiCandidates) {
      const r = await callOpenAI(c.key, c.model, b64);
      if (r.ok) { aiResp = r; usedKeyId = c.poolKeyId; usedKeyLabel = c.label; break; }
      const txt = await r.text();
      lastStatus = r.status; lastBody = txt;
      const detail = extractApiErrorMessage(txt);
      errors.push(`${c.label} [${r.status}]: ${detail}`);
      console.error(`OpenAI ${c.label} failed:`, r.status, txt.slice(0, 500));
      if (c.poolKeyId && shouldCooldown(r.status)) {
        await markPoolCooldown(supa, c.poolKeyId, `${r.status}: ${detail}`);
      }
    }

    for (const c of geminiCandidates) {
      if (aiResp) break;
      const r = await callGemini(c.key, b64);
      if (r.ok) { aiResp = r; usedKeyId = c.poolKeyId; usedKeyLabel = c.label; break; }
      const txt = await r.text();
      lastStatus = r.status; lastBody = txt;
      const detail = extractApiErrorMessage(txt);
      errors.push(`${c.label} [${r.status}]: ${detail}`);
      console.error(`Gemini ${c.label} failed:`, r.status, txt.slice(0, 500));
      if (c.poolKeyId && shouldCooldown(r.status)) {
        await markPoolCooldown(supa, c.poolKeyId, `${r.status}: ${detail}`);
      }
    }

    for (const c of compatibleCandidates) {
      if (aiResp) break;
      const r = await callOpenAICompatiblePdf(c, b64);
      if (r.ok) { aiResp = r; usedKeyId = c.poolKeyId; usedKeyLabel = c.label; break; }
      const txt = await r.text();
      lastStatus = r.status; lastBody = txt;
      const detail = extractApiErrorMessage(txt);
      errors.push(`${c.label} [${r.status}]: ${detail}`);
      console.error(`OpenAI-compatible ${c.label} failed:`, r.status, txt.slice(0, 500));
      if (c.poolKeyId && shouldCooldown(r.status)) {
        await markPoolCooldown(supa, c.poolKeyId, `${r.status}: ${detail}`);
      }
    }

    // Final fallback: Lovable AI Gateway — ปิดโดยค่าเริ่มต้น (Standalone)
    if (!aiResp) {
      const allowLovable = ["1", "true", "yes"].includes((Deno.env.get("ALLOW_LOVABLE_FALLBACK") ?? "").toLowerCase());
      const lovableKey = allowLovable ? Deno.env.get("LOVABLE_API_KEY") : null;
      if (lovableKey) {
        const r = await callLovableGateway(lovableKey, b64);
        if (r.ok) {
          aiResp = r;
          usedKeyLabel = "lovable-gateway";
        } else {
          const txt = await r.text();
          lastStatus = r.status; lastBody = txt;
          errors.push(`lovable [${r.status}]: ${extractApiErrorMessage(txt)}`);
        }
      } else {
        errors.push("standalone: ไม่ใช้ Lovable AI — ตั้งค่า OPENAI_API_KEY / GEMINI_API_KEY หรือ AI Provider ของโรงเรียนเอง");
      }
    }

    if (!aiResp) {
      const message = `AI ไม่พร้อมใช้งาน: ${errors.join(" | ") || "no AI key configured"} — ระบบเปิดโหมดเพิ่มช่องเองบน PDF ให้ใช้งานต่อได้`;
      await markAnalyzeManualFallback(supa, templateId, message);
      return json({ ok: true, fields_count: 0, fields: [], source: "manual_fallback", warning: message });
    }

    // Mark key as used (best-effort)
    if (usedKeyId) {
      await markPoolUsed(supa, usedKeyId);
    }


    const aiJson = await aiResp.json();
    const content = extractAiContent(aiJson, usedKeyLabel);
    let parsed: any;
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      parsed = { fields: [] };
    }

    const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
    // Normalize bbox from [ymin,xmin,ymax,xmax] 0-1000 → percent {page,x,y,w,h} 0-1.
    // Some providers still return [x1,y1,x2,y2] despite instructions; choose the shape that best matches field type.
    const fieldMap = fields.map((f: any, i: number) => {
      const type = ["text", "checkbox", "radio", "date", "signature", "number", "longtext"].includes(f.type) ? f.type : "text";
      const rect = normalizeAiRect(f, type);
      return {
        id: crypto.randomUUID(),
        key: String(f.key || `field_${i + 1}`).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60),
        label: String(f.label || `ช่อง ${i + 1}`),
        type,
        group: f.group ? String(f.group) : null,
        page: Number(f.page) || 1,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        options: Array.isArray(f.options) ? f.options.map(String) : [],
        data_hint: f.data_hint ? String(f.data_hint) : null,
      };
    });

    await supa.from("print_templates").update({
      field_map: fieldMap,
      analyze_status: "done",
      analyzed_at: new Date().toISOString(),
      analyze_error: null,
    }).eq("id", templateId);

    return json({ ok: true, fields_count: fieldMap.length, fields: fieldMap });
  } catch (e: any) {
    console.error("analyze-pdf-template error", e);
    try {
      if (templateId) {
        const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await markAnalyzeError(supa, templateId, String(e?.message || e));
      }
    } catch (_) {}
    return json({ error: String(e?.message || e) }, 500);
  }
});

function clamp(n: number) { return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)); }
function scaleCoord(n: number) {
  if (!Number.isFinite(n)) return 0;
  const v = Math.abs(n) > 100 ? n / 1000 : Math.abs(n) > 1 ? n / 100 : n;
  return clamp(v);
}
type Rect = { x: number; y: number; w: number; h: number };
function normalizeAiRect(f: any, type: string): Rect {
  if (["x", "y", "w", "h"].every((k) => Number.isFinite(Number(f?.[k])))) {
    return { x: scaleCoord(Number(f.x)), y: scaleCoord(Number(f.y)), w: scaleCoord(Number(f.w)), h: scaleCoord(Number(f.h)) };
  }
  const bb = Array.isArray(f?.bbox) ? f.bbox.map((v: any) => Number(v)) : [0, 0, 0, 0];
  const [a, b, c, d] = bb;
  const gemini = rectFromYx(a, b, c, d);
  const xyxy = rectFromXy(a, b, c, d);
  const order = String(f?.bbox_order || f?.coordinate_order || "").toLowerCase();
  if (order.includes("x") && order.indexOf("x") < order.indexOf("y")) return xyxy;
  if (order.includes("y") && order.indexOf("y") < order.indexOf("x")) return gemini;
  return scoreRect(xyxy, type) > scoreRect(gemini, type) + 0.25 ? xyxy : gemini;
}
function rectFromYx(y1: number, x1: number, y2: number, x2: number): Rect {
  const xa = scaleCoord(Math.min(x1, x2));
  const xb = scaleCoord(Math.max(x1, x2));
  const ya = scaleCoord(Math.min(y1, y2));
  const yb = scaleCoord(Math.max(y1, y2));
  return { x: xa, y: ya, w: clamp(xb - xa), h: clamp(yb - ya) };
}
function rectFromXy(x1: number, y1: number, x2: number, y2: number): Rect {
  const xa = scaleCoord(Math.min(x1, x2));
  const xb = scaleCoord(Math.max(x1, x2));
  const ya = scaleCoord(Math.min(y1, y2));
  const yb = scaleCoord(Math.max(y1, y2));
  return { x: xa, y: ya, w: clamp(xb - xa), h: clamp(yb - ya) };
}
function scoreRect(r: Rect, type: string) {
  if (r.w <= 0 || r.h <= 0) return -10;
  if (r.x + r.w > 1.02 || r.y + r.h > 1.02) return -5;
  const ratio = r.w / Math.max(r.h, 0.001);
  if (type === "checkbox" || type === "radio") return 1 - Math.min(1, Math.abs(1 - ratio)) - Math.max(r.w, r.h);
  if (type === "signature") return (ratio > 2 ? 1 : 0) + Math.min(r.w, 0.5) - r.h;
  if (type === "longtext") return (ratio > 2 ? 1 : 0) + Math.min(r.h, 0.25);
  return (ratio > 1.4 ? 1 : 0) + Math.min(r.w, 0.5) - Math.max(0, r.h - 0.08);
}
type AiCandidate = { poolKeyId: string | null; key: string; label: string; model: string };
type OpenAICompatibleCandidate = AiCandidate & { baseUrl: string; providerType: string; extraHeaders?: Record<string, string> | null };

async function resetPoolState(supa: any, provider: string) {
  const today = todayBangkokISO();
  await supa.from("ai_provider_keys")
    .update({ used_today: 0, last_reset_date: today })
    .eq("provider_type", provider)
    .lt("last_reset_date", today);
  await supa.from("ai_provider_keys")
    .update({ status: "active", cooldown_until: null })
    .eq("provider_type", provider)
    .eq("status", "cooldown")
    .lt("cooldown_until", new Date().toISOString());
}

async function loadOpenAICandidates(supa: any): Promise<AiCandidate[]> {
  const candidates: AiCandidate[] = [];

  const { data: poolKeys } = await supa.from("ai_provider_keys")
    .select("id, api_key, label, used_today")
    .eq("provider_type", "openai")
    .eq("status", "active")
    .order("used_today", { ascending: true })
    .limit(20);
  for (const k of (poolKeys || []) as any[]) {
    if (k.api_key) candidates.push({ poolKeyId: k.id, key: k.api_key, label: k.label ? `openai-pool:${k.label}` : `openai-pool:${k.id.slice(0, 6)}`, model: DEFAULT_OPENAI_MODEL });
  }

  const { data: providers } = await supa.from("ai_providers")
    .select("id, name, provider_type, base_url, api_key, model, priority, enabled")
    .eq("enabled", true)
    .order("priority", { ascending: true });
  for (const p of (providers || []) as any[]) {
    const isOpenAI = p.provider_type === "openai" || String(p.base_url || "").includes("api.openai.com");
    if (isOpenAI && p.api_key) {
      candidates.push({ poolKeyId: null, key: p.api_key, label: `provider:openai:${p.name || p.id.slice(0, 6)}`, model: normalizeOpenAIModel(p.model) });
    }
  }

  for (let i = 1; i <= 10; i++) {
    const name = i === 1 ? "OPENAI_API_KEY" : `OPENAI_API_KEY_${i}`;
    const key = Deno.env.get(name);
    if (key) candidates.push({ poolKeyId: null, key, label: `env:${name}`, model: Deno.env.get(`${name}_MODEL`) || DEFAULT_OPENAI_MODEL });
  }

  return dedupeCandidates(candidates);
}

async function loadGeminiCandidates(supa: any): Promise<AiCandidate[]> {
  const candidates: AiCandidate[] = [];
  const { data: poolKeys } = await supa.from("ai_provider_keys")
    .select("id, api_key, label, used_today")
    .eq("provider_type", "gemini")
    .eq("status", "active")
    .order("used_today", { ascending: true })
    .limit(20);
  for (const k of (poolKeys || []) as any[]) {
    if (k.api_key) candidates.push({ poolKeyId: k.id, key: k.api_key, label: k.label ? `gemini-pool:${k.label}` : `gemini-pool:${k.id.slice(0, 6)}`, model: "gemini-2.5-flash" });
  }
  for (let i = 1; i <= 10; i++) {
    const name = i === 1 ? "GEMINI_API_KEY" : `GEMINI_API_KEY_${i}`;
    const key = Deno.env.get(name);
    if (key) candidates.push({ poolKeyId: null, key, label: `env:${name}`, model: "gemini-2.5-flash" });
  }
  return dedupeCandidates(candidates);
}

async function loadOpenAICompatibleCandidates(supa: any): Promise<OpenAICompatibleCandidate[]> {
  const candidates: OpenAICompatibleCandidate[] = [];

  const { data: poolKeys } = await supa.from("ai_provider_keys")
    .select("id, api_key, label, used_today")
    .eq("provider_type", "openrouter")
    .eq("status", "active")
    .order("used_today", { ascending: true })
    .limit(20);
  for (const k of (poolKeys || []) as any[]) {
    if (k.api_key) {
      candidates.push({
        poolKeyId: k.id,
        key: k.api_key,
        label: k.label ? `openrouter-pool:${k.label}` : `openrouter-pool:${k.id.slice(0, 6)}`,
        model: "qwen/qwen2.5-vl-72b-instruct",
        providerType: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      });
    }
  }

  const { data: providers } = await supa.from("ai_providers")
    .select("id, name, provider_type, base_url, api_key, model, priority, enabled, supports_vision, extra_headers")
    .eq("enabled", true)
    .order("priority", { ascending: true });

  for (const p of (providers || []) as any[]) {
    const providerType = String(p.provider_type || "").toLowerCase();
    if (["openai", "gemini", "google", "lovable"].includes(providerType)) continue;

    const baseUrl = normalizeChatCompletionsUrl(p.base_url, providerType);
    if (!baseUrl) continue;

    const supportsVision = p.supports_vision !== false;
    if (!supportsVision) continue;

    const key = (String(p.api_key || "").trim()) || await resolveProviderSecret(providerType);
    if (!key) continue;

    candidates.push({
      poolKeyId: null,
      key,
      label: `provider:${providerType}:${p.name || p.id.slice(0, 6)}`,
      model: normalizeCompatibleModel(providerType, p.model),
      providerType,
      baseUrl,
      extraHeaders: (p.extra_headers && typeof p.extra_headers === "object") ? p.extra_headers : null,
    });
  }

  for (const env of [
    { keyName: "OPENROUTER_API_KEY", providerType: "openrouter", baseUrl: "https://openrouter.ai/api/v1/chat/completions", model: Deno.env.get("OPENROUTER_MODEL") || "qwen/qwen2.5-vl-72b-instruct" },
    { keyName: "DASHSCOPE_API_KEY", providerType: "dashscope", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", model: Deno.env.get("DASHSCOPE_MODEL") || "qwen-vl-plus" },
    { keyName: "QWEN_API_KEY", providerType: "dashscope", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", model: Deno.env.get("QWEN_MODEL") || "qwen-vl-plus" },
  ]) {
    const key = Deno.env.get(env.keyName);
    if (key) candidates.push({ poolKeyId: null, key, label: `env:${env.keyName}`, model: env.model, providerType: env.providerType, baseUrl: env.baseUrl });
  }

  return dedupeCompatibleCandidates(candidates);
}

function callOpenAI(key: string, model: string, b64: string) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: normalizeOpenAIModel(model),
      instructions: SYSTEM_PROMPT,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "วิเคราะห์ทุกช่องในฟอร์ม PDF นี้" },
          { type: "input_text", text: "ตอบกลับเป็น JSON object เท่านั้น และต้องเป็น JSON ที่ parse ได้" },
          { type: "input_file", filename: "template.pdf", file_data: `data:application/pdf;base64,${b64}` },
        ],
      }],
      text: { format: { type: "json_object" } },
    }),
  });
}

function callOpenAICompatiblePdf(c: OpenAICompatibleCandidate, b64: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${c.key}`,
    ...(c.extraHeaders || {}),
  };
  if (c.providerType === "openrouter") {
    headers["HTTP-Referer"] = headers["HTTP-Referer"] || "https://lovable.dev";
    headers["X-Title"] = headers["X-Title"] || "School System";
  }

  return fetch(c.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: c.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "วิเคราะห์ทุกช่องในฟอร์ม PDF นี้ และตอบกลับเป็น JSON object เท่านั้น" },
            { type: "file", file: { filename: "template.pdf", file_data: `data:application/pdf;base64,${b64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });
}

function callGemini(key: string, b64: string) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: "user",
        parts: [
          { text: "วิเคราะห์ทุกช่องในฟอร์ม PDF นี้" },
          { inlineData: { mimeType: "application/pdf", data: b64 } },
        ],
      }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
}

function callLovableGateway(key: string, b64: string) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "วิเคราะห์ทุกช่องในฟอร์ม PDF นี้" },
            { type: "file", file: { filename: "template.pdf", file_data: `data:application/pdf;base64,${b64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
}

function normalizeOpenAIModel(model: string | null | undefined) {
  const m = String(model || DEFAULT_OPENAI_MODEL).trim();
  const normalized = m.startsWith("openai/") ? m.slice("openai/".length) : m;
  return normalized === "gpt-4o-mini" ? DEFAULT_OPENAI_MODEL : normalized;
}

function normalizeCompatibleModel(providerType: string, model: string | null | undefined) {
  const m = String(model || "").trim();
  if (providerType === "openrouter" && (!m || m === "openrouter/free" || m === "google/gemini-2.0-flash-exp:free")) return "qwen/qwen2.5-vl-72b-instruct";
  if ((providerType === "dashscope" || providerType === "openai_compatible") && /^qwen/i.test(m) && !/vl/i.test(m)) return "qwen-vl-plus";
  return m || (providerType === "dashscope" ? "qwen-vl-plus" : "qwen/qwen2.5-vl-72b-instruct");
}

function normalizeChatCompletionsUrl(baseUrl: string | null | undefined, providerType: string) {
  const url = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (url.endsWith("/chat/completions")) return url;
  if (url.endsWith("/v1") || url.endsWith("/compatible-mode/v1") || url.endsWith("/openai/v1")) return `${url}/chat/completions`;
  if (url) return url;
  if (providerType === "openrouter") return "https://openrouter.ai/api/v1/chat/completions";
  if (providerType === "dashscope" || providerType === "openai_compatible") return "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
  if (providerType === "deepseek") return "https://api.deepseek.com/v1/chat/completions";
  if (providerType === "groq") return "https://api.groq.com/openai/v1/chat/completions";
  return "";
}

async function resolveProviderSecret(providerType: string): Promise<string> {
  const secretName = providerType === "dashscope" || providerType === "openai_compatible"
    ? secretKeys.dashscope
    : providerType === "openrouter"
      ? secretKeys.openrouter
      : providerType === "deepseek"
        ? secretKeys.deepseek
        : providerType === "groq"
          ? secretKeys.groq
          : "";
  return secretName ? (await getSecret(secretName)) || "" : "";
}

function extractOpenAIText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  const pieces: string[] = [];
  for (const out of data?.output || []) {
    for (const c of out?.content || []) {
      if (typeof c?.text === "string") pieces.push(c.text);
      if (typeof c?.output_text === "string") pieces.push(c.output_text);
    }
  }
  return pieces.join("\n").trim() || "{}";
}

function extractAiContent(data: any, label: string): string {
  if (label.startsWith("gemini") || label.startsWith("env:GEMINI")) {
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  }
  const chatContent = data?.choices?.[0]?.message?.content;
  if (Array.isArray(chatContent)) {
    return chatContent.map((part: any) => part?.text || part?.content || "").join("\n").trim() || "{}";
  }
  if (typeof chatContent === "string" && chatContent.trim()) return chatContent;
  return extractOpenAIText(data);
}

function dedupeCandidates(candidates: AiCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const fp = `${c.key.slice(0, 12)}:${c.model}`;
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

function dedupeCompatibleCandidates(candidates: OpenAICompatibleCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const fp = `${c.providerType}:${c.baseUrl}:${c.key.slice(0, 12)}:${c.model}`;
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

function shouldCooldown(status: number) { return status === 429 || status === 402 || status === 403; }
async function markPoolCooldown(supa: any, id: string, error: string) {
  await supa.from("ai_provider_keys").update({
    status: "cooldown",
    cooldown_until: new Date(Date.now() + 60 * 60_000).toISOString(),
    last_error: error.slice(0, 300),
  }).eq("id", id);
}
async function markPoolUsed(supa: any, id: string) {
  const { data: cur } = await supa.from("ai_provider_keys").select("used_today, used_total").eq("id", id).maybeSingle();
  await supa.from("ai_provider_keys").update({
    used_today: ((cur as any)?.used_today || 0) + 1,
    used_total: ((cur as any)?.used_total || 0) + 1,
    last_used_at: new Date().toISOString(),
  }).eq("id", id);
}
function parseGatewayError(text: string): { type?: string; message?: string; details?: string } {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
function extractApiErrorMessage(text: string): string {
  try {
    const j = JSON.parse(text);
    return (j?.error?.message || j?.error?.code || j?.message || JSON.stringify(j?.error || j)).toString().slice(0, 250);
  } catch {
    return text.slice(0, 200);
  }
}
function extractStatuses(errors: string[]): number[] {
  return errors
    .map((e) => e.match(/\[(\d{3})\]|:\s*(\d{3})(?:\D|$)/)?.[1] || e.match(/\[(\d{3})\]|:\s*(\d{3})(?:\D|$)/)?.[2])
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n >= 100);
}
async function markAnalyzeError(supa: any, templateId: string, message: string) {
  await supa.from("print_templates").update({
    analyze_status: "error",
    analyze_error: message,
  }).eq("id", templateId);
}
async function markAnalyzeManualFallback(supa: any, templateId: string, message: string) {
  await supa.from("print_templates").update({
    field_map: [],
    analyze_status: "done",
    analyzed_at: new Date().toISOString(),
    analyze_error: message,
  }).eq("id", templateId);
}
function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}

// === AcroForm extraction (deterministic, no AI required) ===
async function extractAcroFormFields(bytes: Uint8Array): Promise<any[]> {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  if (!fields || fields.length === 0) return [];

  const pages = pdfDoc.getPages();
  const out: any[] = [];

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const name = f.getName();
    const ctor = f.constructor?.name || "PDFTextField";

    // Type mapping from pdf-lib field class to our schema
    let type: string = "text";
    if (ctor.includes("CheckBox")) type = "checkbox";
    else if (ctor.includes("RadioGroup")) type = "radio";
    else if (ctor.includes("Dropdown") || ctor.includes("OptionList")) type = "text";
    else if (ctor.includes("Signature")) type = "signature";
    else type = "text";

    // Get first widget annotation to find page + position
    let page = 1;
    let x = 0, y = 0, w = 0, h = 0;
    try {
      const widgets = (f as any).acroField?.getWidgets?.() || [];
      if (widgets.length > 0) {
        const widget = widgets[0];
        const rect = widget.getRectangle();
        // Find which page contains this widget
        const widgetRef = widget.ref;
        for (let p = 0; p < pages.length; p++) {
          const annots = pages[p].node.Annots();
          if (annots) {
            const arr = annots.asArray();
            if (arr.some((a: any) => a === widgetRef)) {
              page = p + 1;
              const { width: pw, height: ph } = pages[p].getSize();
              // PDF coords are bottom-left; convert to top-left percent
              x = rect.x / pw;
              y = 1 - (rect.y + rect.height) / ph;
              w = rect.width / pw;
              h = rect.height / ph;
              break;
            }
          }
        }
      }
    } catch (_) {}

    let options: string[] = [];
    try {
      if (type === "radio") options = (f as any).getOptions?.() || [];
    } catch (_) {}

    out.push({
      id: crypto.randomUUID(),
      key: name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60) || `field_${i + 1}`,
      label: name,
      type,
      group: null,
      page,
      x: clamp(x), y: clamp(y), w: clamp(w), h: clamp(h),
      options,
      data_hint: null,
    });
  }

  return out;
}
