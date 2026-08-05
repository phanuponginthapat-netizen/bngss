// API Key Pool — rotate across multiple keys per provider (openai/gemini/groq/openrouter).
// Picks the active key with the lowest used_today; on 429/402/403 marks cooldown 1h and tries next.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { todayBangkokISO } from "../_shared/thaiDate.ts";

export type PoolProvider =
  | "openai" | "gemini" | "groq" | "openrouter"
  | "cerebras" | "glm" | "huggingface" | "github" | "sambanova" | "cohere"
  | "deepseek" | "mistral" | "together" | "xai" | "fireworks" | "nvidia"
  | "dashscope" | "perplexity" | "anthropic";

interface KeyRow {
  id: string;
  api_key: string;
  label: string | null;
  status: string;
  used_today: number;
  cooldown_until: string | null;
  last_reset_date: string;
}

const PROVIDER_CFG: Record<PoolProvider, {
  url: string;
  defaultModel: string;
  visionModel: string;
  buildHeaders: (key: string) => Record<string, string>;
  buildBody: (model: string, messages: any[], opts: { temperature?: number; max_tokens?: number; json?: boolean }) => any;
}> = {
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    visionModel: "gpt-4o-mini",
    buildHeaders: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    buildBody: (model, messages, opts) => {
      const body: any = { model, messages, temperature: opts.temperature ?? 0.7 };
      if (opts.max_tokens) body.max_tokens = opts.max_tokens;
      if (opts.json) body.response_format = { type: "json_object" };
      return body;
    },
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.5-flash",
    visionModel: "gemini-2.5-flash",
    buildHeaders: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    buildBody: (model, messages, opts) => {
      const body: any = { model, messages, temperature: opts.temperature ?? 0.7 };
      if (opts.max_tokens) body.max_tokens = opts.max_tokens;
      if (opts.json) body.response_format = { type: "json_object" };
      return body;
    },
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    visionModel: "llama-3.2-90b-vision-preview",
    buildHeaders: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    buildBody: (model, messages, opts) => {
      const body: any = { model, messages, temperature: opts.temperature ?? 0.7 };
      if (opts.max_tokens) body.max_tokens = opts.max_tokens;
      if (opts.json) body.response_format = { type: "json_object" };
      return body;
    },
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "deepseek/deepseek-chat-v3.1:free",
    visionModel: "qwen/qwen2.5-vl-72b-instruct:free",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": Deno.env.get("PUBLIC_ORIGIN") || Deno.env.get("APP_URL") || "https://bngss.lovable.app",
      "X-Title": "School System",
    }),
    buildBody: (model, messages, opts) => {
      const body: any = { model, messages, temperature: opts.temperature ?? 0.7 };
      if (opts.max_tokens) body.max_tokens = opts.max_tokens;
      if (opts.json) body.response_format = { type: "json_object" };
      return body;
    },
  },
  cerebras:    mkOAI("https://api.cerebras.ai/v1/chat/completions", "llama-3.3-70b"),
  glm:         mkOAI("https://open.bigmodel.cn/api/paas/v4/chat/completions", "glm-4-flash"),
  huggingface: mkOAI("https://api-inference.huggingface.co/v1/chat/completions", "meta-llama/Llama-3.3-70B-Instruct"),
  github:      mkOAI("https://models.inference.ai.azure.com/chat/completions", "gpt-4o-mini", "gpt-4o-mini"),
  sambanova:   mkOAI("https://api.sambanova.ai/v1/chat/completions", "Meta-Llama-3.3-70B-Instruct"),
  cohere:      mkOAI("https://api.cohere.ai/compatibility/v1/chat/completions", "command-r-plus-08-2024"),
  deepseek:    mkOAI("https://api.deepseek.com/v1/chat/completions", "deepseek-chat"),
  mistral:     mkOAI("https://api.mistral.ai/v1/chat/completions", "mistral-small-latest"),
  together:    mkOAI("https://api.together.xyz/v1/chat/completions", "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
  xai:         mkOAI("https://api.x.ai/v1/chat/completions", "grok-2-1212", "grok-2-vision-1212"),
  fireworks:   mkOAI("https://api.fireworks.ai/inference/v1/chat/completions", "accounts/fireworks/models/llama-v3p3-70b-instruct"),
  nvidia:      mkOAI("https://integrate.api.nvidia.com/v1/chat/completions", "meta/llama-3.3-70b-instruct"),
  dashscope:   mkOAI("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", "qwen-plus", "qwen-vl-plus"),
  perplexity:  mkOAI("https://api.perplexity.ai/chat/completions", "sonar"),
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-5-sonnet-20241022",
    visionModel: "claude-3-5-sonnet-20241022",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    }),
    buildBody: (model, messages, opts) => {
      // Extract system + user/assistant for Anthropic format
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const rest = messages.filter((m) => m.role !== "system");
      const body: any = {
        model,
        messages: rest,
        max_tokens: opts.max_tokens || 4096,
        temperature: opts.temperature ?? 0.7,
      };
      if (system) body.system = system;
      return body;
    },
  },
};

function mkOAI(url: string, defaultModel: string, visionModel?: string) {
  return {
    url,
    defaultModel,
    visionModel: visionModel || defaultModel,
    buildHeaders: (key: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    buildBody: (model: string, messages: any[], opts: { temperature?: number; max_tokens?: number; json?: boolean }) => {
      const body: any = { model, messages, temperature: opts.temperature ?? 0.7 };
      if (opts.max_tokens) body.max_tokens = opts.max_tokens;
      if (opts.json) body.response_format = { type: "json_object" };
      return body;
    },
  };
}

function sb() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function loadKeys(provider: PoolProvider): Promise<KeyRow[]> {
  const today = todayBangkokISO();
  const client = sb();

  // Reset used_today + clear cooldown if expired
  await client.from("ai_provider_keys")
    .update({ used_today: 0, last_reset_date: today })
    .eq("provider_type", provider)
    .lt("last_reset_date", today);

  await client.from("ai_provider_keys")
    .update({ status: "active", cooldown_until: null })
    .eq("provider_type", provider)
    .eq("status", "cooldown")
    .lt("cooldown_until", new Date().toISOString());

  const { data } = await client.from("ai_provider_keys")
    .select("id,api_key,label,status,used_today,cooldown_until,last_reset_date")
    .eq("provider_type", provider)
    .eq("status", "active")
    .order("used_today", { ascending: true })
    .limit(20);

  return (data as KeyRow[]) || [];
}

async function markCooldown(id: string, error: string, minutes = 60) {
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  await sb().from("ai_provider_keys").update({
    status: "cooldown",
    cooldown_until: until,
    last_error: error.slice(0, 300),
  }).eq("id", id);
}

async function markUsed(id: string) {
  // increment using rpc-like update (best-effort)
  const client = sb();
  const { data } = await client.from("ai_provider_keys").select("used_today,used_total").eq("id", id).maybeSingle();
  await client.from("ai_provider_keys").update({
    used_today: ((data as any)?.used_today || 0) + 1,
    used_total: ((data as any)?.used_total || 0) + 1,
    last_used_at: new Date().toISOString(),
  }).eq("id", id);
}

export interface PoolCallOpts {
  messages: any[];
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
  vision?: boolean;
  model?: string; // optional override
}

export interface PoolCallResult {
  content: string;
  provider: PoolProvider;
  model: string;
  keyLabel: string;
}

/**
 * Try every active key in the pool for a given provider.
 * Returns first success, or throws aggregated errors.
 */
export async function callWithPool(provider: PoolProvider, opts: PoolCallOpts): Promise<PoolCallResult> {
  const cfg = PROVIDER_CFG[provider];
  const keys = await loadKeys(provider);
  if (keys.length === 0) throw new Error(`No active ${provider} keys in pool`);

  const model = opts.model || (opts.vision ? cfg.visionModel : cfg.defaultModel);
  const errors: string[] = [];

  for (const k of keys) {
    try {
      const r = await fetch(cfg.url, {
        method: "POST",
        headers: cfg.buildHeaders(k.api_key),
        body: JSON.stringify(cfg.buildBody(model, opts.messages, opts)),
      });
      if (r.status === 429 || r.status === 402 || r.status === 403) {
        const t = await r.text();
        await markCooldown(k.id, `${r.status}: ${t.slice(0, 200)}`);
        errors.push(`${k.label || k.id.slice(0, 8)}: ${r.status}`);
        continue;
      }
      if (!r.ok) {
        const t = await r.text();
        errors.push(`${k.label || k.id.slice(0, 8)}: ${r.status} ${t.slice(0, 100)}`);
        continue;
      }
      const data = await r.json();
      const content = provider === "anthropic"
        ? (Array.isArray(data?.content) ? data.content.map((c: any) => c?.text || "").join("") : "")
        : data?.choices?.[0]?.message?.content;
      if (!content) {
        errors.push(`${k.label || k.id.slice(0, 8)}: empty`);
        continue;
      }
      await markUsed(k.id);
      return { content, provider, model, keyLabel: k.label || "key" };
    } catch (e: any) {
      errors.push(`${k.label || k.id.slice(0, 8)}: ${e?.message || e}`);
      continue;
    }
  }
  throw new Error(`All ${provider} pool keys failed: ${errors.join(" | ")}`);
}

/**
 * Try multiple providers in order, each with its own key pool.
 */
export async function callWithMultiPool(
  providers: PoolProvider[],
  opts: PoolCallOpts,
): Promise<PoolCallResult> {
  const errors: string[] = [];
  for (const p of providers) {
    try {
      return await callWithPool(p, opts);
    } catch (e: any) {
      errors.push(`[${p}] ${e?.message || e}`);
      continue;
    }
  }
  throw new Error("All pool providers failed: " + errors.join(" || "));
}
