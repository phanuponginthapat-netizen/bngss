// AI call helper — providers loaded from DB (admin-managed) + Key Pool (gemini/groq/openrouter).
// Standalone: ทุก provider ใช้ api_key ของโรงเรียนเอง (ไม่มี Lovable AI gateway)
// Adds aiCouncil() for multi-model parallel analysis + synthesis.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callWithPool, type PoolProvider } from "./keyPool.ts";
import { getSecret } from "./getSecret.ts";
import { secretKeys } from "./secretKeys.ts";
import { NO_LOVABLE_AI_MSG } from "./standalone.ts";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: any;
}

export interface AICallOpts {
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
  vision?: boolean;
  functionName?: string; // for usage log
  userId?: string;
}

export interface AIResult {
  content: string;
  provider: string;
  model: string;
}

// Rough USD per 1K tokens (very approximate; used for admin dashboard estimates only)
const COST_TABLE: Record<string, { in: number; out: number }> = {
  "google/gemini-3.5-flash": { in: 0.00015, out: 0.0006 },
  "google/gemini-2.5-flash": { in: 0.000075, out: 0.0003 },
  "google/gemini-2.5-pro": { in: 0.00125, out: 0.005 },
  "openai/gpt-5": { in: 0.0025, out: 0.01 },
  "openai/gpt-5-mini": { in: 0.00015, out: 0.0006 },
  "openai/gpt-5-nano": { in: 0.00005, out: 0.0002 },
  "deepseek/deepseek-chat-v3.1:free": { in: 0, out: 0 },
  "qwen/qwen-2.5-72b-instruct:free": { in: 0, out: 0 },
  "qwen/qwen2.5-vl-72b-instruct:free": { in: 0, out: 0 },
};

function estimateCost(model: string, inTok: number, outTok: number): number {
  const c = COST_TABLE[model];
  if (!c) return 0;
  return +(((inTok / 1000) * c.in) + ((outTok / 1000) * c.out)).toFixed(6);
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

interface ProviderRow {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string | null;
  model: string;
  priority: number;
  enabled: boolean;
  supports_vision: boolean;
  supports_json: boolean;
  monthly_call_limit: number | null;
  extra_headers: Record<string, string> | null;
}

async function loadProviders(vision: boolean): Promise<ProviderRow[]> {
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from("ai_providers")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: true });
    if (!data) return [];
    let list = (data as ProviderRow[]).filter((p) => !vision || p.supports_vision);

    // Enforce monthly_call_limit: drop providers that hit cap this month
    const withLimits = list.filter((p) => p.monthly_call_limit && p.monthly_call_limit > 0);
    if (withLimits.length) {
      const start = new Date();
      start.setDate(1); start.setHours(0, 0, 0, 0);
      const { data: counts } = await sb
        .from("ai_usage_logs")
        .select("provider_id")
        .gte("created_at", start.toISOString())
        .in("provider_id", withLimits.map((p) => p.id));
      const tally: Record<string, number> = {};
      (counts || []).forEach((r: any) => {
        if (r.provider_id) tally[r.provider_id] = (tally[r.provider_id] || 0) + 1;
      });
      list = list.filter((p) => {
        if (!p.monthly_call_limit || p.monthly_call_limit <= 0) return true;
        return (tally[p.id] || 0) < p.monthly_call_limit;
      });
    }
    return list;
  } catch {
    return [];
  }
}

async function resolveApiKey(p: ProviderRow): Promise<string | undefined> {
  // Standalone: ไม่รองรับ provider แบบ Lovable AI แล้ว
  if (p.provider_type === "lovable") return undefined;
  // For everything else, use the api_key column directly (admin pastes vendor key)
  if (p.api_key && p.api_key.trim()) return p.api_key.trim();
  // Optional env fallbacks for common providers
  if (p.provider_type === "openrouter") return (await getSecret(secretKeys.openrouter)) || undefined;
  if (p.provider_type === "openai") return (await getSecret(secretKeys.openai)) || undefined;
  if (p.provider_type === "deepseek") return (await getSecret(secretKeys.deepseek)) || undefined;
  if (p.provider_type === "groq") return (await getSecret(secretKeys.groq)) || undefined;
  if (p.provider_type === "gemini" || p.provider_type === "google") return (await getSecret(secretKeys.gemini)) || undefined;
  if (p.provider_type === "dashscope") return (await getSecret(secretKeys.dashscope)) || undefined;
  return undefined;
}

async function logUsage(opts: {
  provider_id: string | null;
  provider_name: string;
  model: string;
  function_name?: string;
  tokens_input: number;
  tokens_output: number;
  success: boolean;
  error_message?: string;
  latency_ms: number;
  called_by?: string;
}) {
  try {
    const sb = getServiceClient();
    await sb.from("ai_usage_logs").insert({
      provider_id: opts.provider_id,
      provider_name: opts.provider_name,
      model: opts.model,
      function_name: opts.function_name,
      tokens_input: opts.tokens_input,
      tokens_output: opts.tokens_output,
      estimated_cost: estimateCost(opts.model, opts.tokens_input, opts.tokens_output),
      success: opts.success,
      error_message: opts.error_message?.slice(0, 500),
      latency_ms: opts.latency_ms,
      called_by: opts.called_by,
    });
  } catch (_) { /* ignore log failure */ }
}

export async function aiCall(opts: AICallOpts): Promise<AIResult> {
  let providers = await loadProviders(!!opts.vision);

  // Hard fallback if DB empty or no providers configured (Standalone: ไม่ใช้ Lovable AI)
  if (providers.length === 0) {
    // ถ้าไม่มี provider ใน DB เลย ให้ตกไปใช้ Key Pool ด้านล่าง (openai/gemini/groq/openrouter)
  }

  const errors: string[] = [];
  for (const p of providers) {
    const key = await resolveApiKey(p);
    if (!key) {
      errors.push(`${p.name}: missing API key`);
      continue;
    }
    const started = Date.now();
    try {
      const body: any = {
        model: p.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
      };
      if (opts.max_tokens) body.max_tokens = opts.max_tokens;
      // Only request JSON mode if provider supports it (default true for unknown/legacy rows)
      if (opts.json && p.supports_json !== false) body.response_format = { type: "json_object" };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        ...(p.extra_headers || {}),
      };
      // OpenRouter recommends these
      if (p.provider_type === "openrouter") {
        headers["HTTP-Referer"] = headers["HTTP-Referer"] || (Deno.env.get("APP_URL") || "https://school.local");
        headers["X-Title"] = headers["X-Title"] || "School System";
      }

      const r = await fetch(p.base_url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const latency = Date.now() - started;

      if (!r.ok) {
        const t = await r.text();
        const msg = `${p.name}:${r.status}:${t.slice(0, 200)}`;
        errors.push(msg);
        await logUsage({
          provider_id: p.id === "default" ? null : p.id,
          provider_name: p.name,
          model: p.model,
          function_name: opts.functionName,
          tokens_input: 0,
          tokens_output: 0,
          success: false,
          error_message: msg,
          latency_ms: latency,
          called_by: opts.userId,
        });
        continue;
      }
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content;
      const usage = data?.usage || {};
      if (!content) {
        errors.push(`${p.name}: empty content`);
        continue;
      }

      await logUsage({
        provider_id: p.id === "default" ? null : p.id,
        provider_name: p.name,
        model: p.model,
        function_name: opts.functionName,
        tokens_input: usage.prompt_tokens || 0,
        tokens_output: usage.completion_tokens || 0,
        success: true,
        latency_ms: latency,
        called_by: opts.userId,
      });

      return { content, provider: p.name, model: p.model };
    } catch (e: any) {
      const msg = `${p.name}: exception ${e?.message || e}`;
      errors.push(msg);
      await logUsage({
        provider_id: p.id === "default" ? null : p.id,
        provider_name: p.name,
        model: p.model,
        function_name: opts.functionName,
        tokens_input: 0,
        tokens_output: 0,
        success: false,
        error_message: msg,
        latency_ms: Date.now() - started,
        called_by: opts.userId,
      });
      continue;
    }
  }

  // === Final fallback: Key Pool (openai → gemini → groq → openrouter) ===
  const poolOrder: PoolProvider[] = ["openai", "gemini", "groq", "openrouter"];
  for (const p of poolOrder) {
    const started = Date.now();
    try {
      const r = await callWithPool(p, {
        messages: opts.messages,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens,
        json: opts.json,
        vision: opts.vision,
      });
      await logUsage({
        provider_id: null,
        provider_name: `pool:${p}/${r.keyLabel}`,
        model: r.model,
        function_name: opts.functionName,
        tokens_input: 0,
        tokens_output: 0,
        success: true,
        latency_ms: Date.now() - started,
        called_by: opts.userId,
      });
      return { content: r.content, provider: `pool:${p}`, model: r.model };
    } catch (e: any) {
      errors.push(`pool:${p}: ${e?.message || e}`);
      continue;
    }
  }

  const hint = errors.length === 0
    ? (opts.vision
        ? "ไม่มี AI provider ที่รองรับ Vision/OCR — admin ต้องเปิดใช้งาน provider ที่ supports_vision=true หรือเพิ่ม key ที่ /dashboard/admin/ai-key-pool"
        : "ไม่มี AI provider ที่เปิดใช้งานและมี API key — admin โปรดตั้งค่าที่ /dashboard/admin/ai-providers หรือ /dashboard/admin/ai-key-pool")
    : "All AI providers failed: " + errors.join(" | ");
  if (errors.length === 0) console.warn(NO_LOVABLE_AI_MSG);
  throw new Error(hint);
}

// ============================================================
// aiCouncil — runs multiple pool providers in parallel, then asks
// a synthesizer model to merge their analyses into the best answer.
// Use for high-stakes / complex tasks where breadth + cross-check matter.
// ============================================================
export interface CouncilOpts extends AICallOpts {
  providers?: PoolProvider[];
  synthesizer?: PoolProvider;
  synthesize?: boolean;
}

export interface CouncilResult extends AIResult {
  panel: Array<{ provider: string; model: string; content: string; ok: boolean; error?: string }>;
}

export async function aiCouncil(opts: CouncilOpts): Promise<CouncilResult> {
  const providers = opts.providers || ["openai", "gemini", "groq", "openrouter"];
  const synth = opts.synthesizer || "openai";

  const results = await Promise.all(providers.map(async (p) => {
    try {
      const r = await callWithPool(p, {
        messages: opts.messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.max_tokens,
        json: false,
        vision: opts.vision,
      });
      return { provider: `pool:${p}`, model: r.model, content: r.content, ok: true as const };
    } catch (e: any) {
      return { provider: `pool:${p}`, model: "", content: "", ok: false as const, error: String(e?.message || e) };
    }
  }));

  const successes = results.filter((r) => r.ok);
  if (successes.length === 0) {
    const single = await aiCall(opts);
    return { ...single, panel: results };
  }
  if (opts.synthesize === false || successes.length === 1) {
    const best = successes[0];
    return { content: best.content, provider: best.provider, model: best.model, panel: results };
  }

  const userQuestion = opts.messages.map((m: any) =>
    typeof m.content === "string" ? `[${m.role}] ${m.content}` : `[${m.role}] (multimodal)`
  ).join("\n");

  const synthMessages = [
    {
      role: "system",
      content:
        "คุณเป็นผู้สังเคราะห์คำตอบของ AI หลายตัวสำหรับระบบโรงเรียนไทย " +
        "วิเคราะห์จุดแข็ง/จุดอ่อนของแต่ละคำตอบ ตัดข้อมูลผิด รวมข้อมูลที่ถูกต้องและครบถ้วนที่สุด " +
        "ตอบเป็นคำตอบเดียวที่กระชับ ชัดเจน เป็นภาษาไทย เว้นแต่ผู้ใช้ถามภาษาอื่น",
    },
    {
      role: "user",
      content:
        `คำถาม/บริบทเดิม:\n${userQuestion}\n\n` +
        successes.map((s, i) => `--- คำตอบ AI #${i + 1} (${s.provider}) ---\n${s.content}`).join("\n\n") +
        `\n\nสังเคราะห์คำตอบสุดท้ายที่ดีที่สุด:`,
    },
  ];

  try {
    const merged = await callWithPool(synth, {
      messages: synthMessages,
      temperature: 0.3,
      max_tokens: opts.max_tokens,
    });
    return { content: merged.content, provider: `council:${synth}`, model: merged.model, panel: results };
  } catch {
    const best = successes[0];
    return { content: best.content, provider: best.provider, model: best.model, panel: results };
  }
}

