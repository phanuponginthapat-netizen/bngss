// Image generation helper — uses providers from ai_providers table (Gemini, OpenAI).
// DeepSeek/Groq/OpenRouter-free do not support image generation and are skipped.
// LOVABLE_API_KEY is NOT used here — admin-supplied vendor keys only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret } from "./getSecret.ts";
import { secretKeys } from "./secretKeys.ts";

export interface ImageGenResult {
  imageUrl?: string;     // data: URL (base64 PNG)
  provider?: string;
  model?: string;
  errors: string[];
}

interface ProviderRow {
  id: string;
  name: string;
  provider_type: string;
  api_key: string | null;
  enabled: boolean;
  priority: number;
}

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function resolveKey(p: ProviderRow): Promise<string | undefined> {
  if (p.api_key && p.api_key.trim()) return p.api_key.trim();
  if (p.provider_type === "gemini") return (await getSecret(secretKeys.gemini)) || undefined;
  if (p.provider_type === "openai") return (await getSecret(secretKeys.openai)) || undefined;
  return undefined;
}

async function loadImageProviders(): Promise<ProviderRow[]> {
  const { data } = await svc()
    .from("ai_providers")
    .select("id,name,provider_type,api_key,enabled,priority")
    .eq("enabled", true)
    .in("provider_type", ["gemini", "openai"])
    .order("priority", { ascending: true });
  return (data || []) as ProviderRow[];
}

async function genGemini(key: string, prompt: string): Promise<{ b64?: string; error?: string; model: string }> {
  const model = "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  if (!r.ok) return { error: `${r.status}:${(await r.text()).slice(0, 200)}`, model };
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const b64 = p?.inlineData?.data || p?.inline_data?.data;
    if (b64) return { b64, model };
  }
  return { error: "no image in response", model };
}

async function genOpenAI(key: string, prompt: string): Promise<{ b64?: string; error?: string; model: string }> {
  const model = "gpt-image-1";
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
  });
  if (!r.ok) return { error: `${r.status}:${(await r.text()).slice(0, 200)}`, model };
  const data = await r.json();
  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;
  if (b64) return { b64, model };
  if (url) {
    // Fetch and convert to base64 for uniform output
    try {
      const ir = await fetch(url);
      const buf = new Uint8Array(await ir.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return { b64: btoa(bin), model };
    } catch (e: any) {
      return { error: `fetch-url:${e?.message || e}`, model };
    }
  }
  return { error: "empty image", model };
}

export async function generateImage(prompt: string): Promise<ImageGenResult> {
  const providers = await loadImageProviders();
  const errors: string[] = [];
  if (providers.length === 0) {
    return { errors: ["no image-capable provider configured (need Gemini or OpenAI in ai_providers)"] };
  }
  for (const p of providers) {
    const key = await resolveKey(p);
    if (!key) { errors.push(`${p.name}: missing api_key`); continue; }
    try {
      const out = p.provider_type === "gemini"
        ? await genGemini(key, prompt)
        : await genOpenAI(key, prompt);
      if (out.b64) {
        return {
          imageUrl: `data:image/png;base64,${out.b64}`,
          provider: p.name,
          model: out.model,
          errors,
        };
      }
      errors.push(`${p.name}:${out.error}`);
    } catch (e: any) {
      errors.push(`${p.name}:${e?.message || e}`);
    }
  }
  return { errors };
}
