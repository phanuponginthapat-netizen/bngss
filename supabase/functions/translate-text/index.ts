// Translate arbitrary text using optional provider keys when available,
// otherwise fall back to the admin-managed key pool.
import { getSecret } from "../_shared/getSecret.ts";
import { secretKeys } from "../_shared/secretKeys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANG_NAMES: Record<string, string> = {
  th: "Thai",
  en: "English",
  my: "Burmese (Myanmar)",
  "zh-CN": "Simplified Chinese",
  ja: "Japanese",
  ko: "Korean",
  vi: "Vietnamese",
  lo: "Lao",
  km: "Khmer",
  ms: "Malay",
  id: "Indonesian",
  fr: "French",
  de: "German",
  es: "Spanish",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(prompt: string, opts: { json?: boolean; maxTokens?: number } = {}, key?: string | null) {
  if (!key) throw new Error("Gemini provider key not configured");

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  };
  if (opts.json) body.generationConfig.responseMimeType = "application/json";

  // Retry on 429/5xx to absorb Gemini free-tier RPM limits.
  const maxAttempts = 4;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await fetch(GEMINI_URL(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (r.ok) {
      const data = await r.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
      if (!text) throw new Error("Gemini empty response");
      return text;
    }

    const t = await r.text();
    const err = new Error(`Gemini ${r.status}: ${t.slice(0, 500)}`);
    (err as Error & { status?: number }).status = r.status;
    lastErr = err;

    const retryable = r.status === 429 || r.status >= 500;
    if (!retryable || attempt === maxAttempts) throw err;

    // Honor RetryInfo when Gemini provides it, else exponential backoff.
    let delayMs = 0;
    try {
      const j = JSON.parse(t);
      const info = j?.error?.details?.find((d: any) => String(d?.["@type"] || "").includes("RetryInfo"));
      const sec = info?.retryDelay ? parseFloat(String(info.retryDelay).replace("s", "")) : 0;
      if (sec > 0) delayMs = Math.min(sec * 1000, 15000);
    } catch { /* ignore */ }
    if (!delayMs) delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
    await sleep(delayMs);
  }
  throw lastErr;
}

// ---------- OpenAI-compatible providers (DeepSeek, Qwen) ----------
async function callOpenAICompat(
  cfg: { name: string; url: string; key: string | undefined; model: string },
  prompt: string,
  opts: { json?: boolean; maxTokens?: number } = {},
) {
  if (!cfg.key) throw new Error(`${cfg.name}_API_KEY not configured`);
  const body: any = {
    model: cfg.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const maxAttempts = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content ?? "";
      if (!text) throw new Error(`${cfg.name} empty response`);
      return text as string;
    }
    const t = await r.text();
    const err = new Error(`${cfg.name} ${r.status}: ${t.slice(0, 400)}`);
    (err as Error & { status?: number }).status = r.status;
    lastErr = err;
    const retryable = r.status === 429 || r.status >= 500;
    if (!retryable || attempt === maxAttempts) throw err;
    await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 6000));
  }
  throw lastErr;
}

const DEEPSEEK = {
  name: "DEEPSEEK",
  url: "https://api.deepseek.com/chat/completions",
  model: "deepseek-chat",
};
const QWEN = {
  name: "QWEN",
  // International DashScope endpoint (works for keys from dashscope.console.aliyun.com too)
  url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  model: "qwen-plus",
};
const OPENROUTER = {
  name: "OPENROUTER",
  url: "https://openrouter.ai/api/v1/chat/completions",
  model: "deepseek/deepseek-chat-v3.1",
};

type Provider = "gemini" | "deepseek" | "qwen" | "openrouter";

async function callAI(
  prompt: string,
  opts: { json?: boolean; maxTokens?: number } = {},
): Promise<{ text: string; provider: Provider; model: string }> {
  const [geminiKey, deepseekKey, dashscopeKey, openrouterKey] = await Promise.all([
    getSecret(secretKeys.gemini),
    getSecret(secretKeys.deepseek),
    getSecret(secretKeys.dashscope),
    getSecret(secretKeys.openrouter),
  ]);
  const errs: string[] = [];
  const tryProv = async (
    p: Provider,
    fn: () => Promise<string>,
    model: string,
  ) => {
    try {
      const text = await fn();
      return { text, provider: p, model };
    } catch (e: any) {
      errs.push(`${p}: ${e?.message || e}`);
      return null;
    }
  };

  if (geminiKey) {
    const r = await tryProv("gemini", () => callGemini(prompt, opts, geminiKey), GEMINI_MODEL);
    if (r) return r;
  }
  if (deepseekKey) {
    const r = await tryProv(
      "deepseek",
      () => callOpenAICompat({ ...DEEPSEEK, key: deepseekKey }, prompt, opts),
      DEEPSEEK.model,
    );
    if (r) return r;
  }
  if (dashscopeKey) {
    const r = await tryProv(
      "qwen",
      () => callOpenAICompat({ ...QWEN, key: dashscopeKey }, prompt, opts),
      QWEN.model,
    );
    if (r) return r;
  }
  if (openrouterKey) {
    const r = await tryProv(
      "openrouter",
      () => callOpenAICompat({ ...OPENROUTER, key: openrouterKey }, prompt, opts),
      OPENROUTER.model,
    );
    if (r) return r;
  }
  // === Final fallback: Admin-managed key pool (gemini → groq → openrouter) ===
  try {
    const { callWithMultiPool } = await import("../_shared/keyPool.ts");
    const r = await callWithMultiPool(["gemini", "groq", "openrouter"], {
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: opts.maxTokens ?? 2048,
      json: opts.json,
    });
    return { text: r.content, provider: (`pool:${r.provider}`) as unknown as Provider, model: r.model };
  } catch (e: any) {
    errs.push(`pool: ${e?.message || e}`);
  }
  const err = new Error(`All providers failed -> ${errs.join(" | ") || "no provider configured"}`);
  (err as any).status = 503;
  throw err;
}

function extractTranslations(content: string, expected: number): string[] | null {
  const cleaned = content.trim().replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const tryParse = (s: string) => {
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) return p.map((v) => String(v ?? ""));
      if (Array.isArray((p as any)?.translations)) {
        return (p as any).translations.map((v: any) => String(v ?? ""));
      }
    } catch { /* ignore */ }
    return null;
  };
  let out = tryParse(cleaned);
  if (!out) {
    const s = cleaned.indexOf("[");
    const e = cleaned.lastIndexOf("]");
    if (s !== -1 && e > s) out = tryParse(cleaned.slice(s, e + 1));
  }
  if (!out) return null;
  if (out.length !== expected) return null;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, texts, target = "en" } = await req.json();
    const clean = (text || "").toString().trim().slice(0, 4000);
    const cleanTexts = Array.isArray(texts)
      ? texts.map((item) => String(item ?? "").trim().slice(0, 1200)).filter(Boolean).slice(0, 60)
      : [];
    const targetName = LANG_NAMES[target] || target;

    if (cleanTexts.length > 0) {
      const prompt =
        `Translate each array item into ${targetName}. ` +
        `Return JSON only in this exact format: {"translations":["t1","t2",...]}. ` +
        `Keep the same order and same number of items. Preserve numbers, names, line breaks, and formatting.\n\n` +
        `INPUT:\n${JSON.stringify(cleanTexts)}`;

      const { text: content, provider, model } = await callAI(prompt, { json: true, maxTokens: 8192 });
      const translations = extractTranslations(content, cleanTexts.length);
      if (!translations) throw new Error("invalid translation batch response");

      return new Response(
        JSON.stringify({ translations, provider, model }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!clean) {
      return new Response(JSON.stringify({ translation: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt =
      `Translate the following text into ${targetName}. ` +
      `Return ONLY the translated text — no quotes, no explanations, no language labels. ` +
      `Preserve numbers, names, line breaks, and formatting.\n\nTEXT:\n${clean}`;

    const { text: out, provider, model } = await callAI(prompt, { maxTokens: 1200 });

    return new Response(
      JSON.stringify({ translation: out.trim(), provider, model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    const msg = e?.message || "translate failed";
    const status = Number(e?.status ?? 0);
    const isAllProviders = /All providers failed/i.test(msg);
    const isMissingKey = /no provider configured|not configured/i.test(msg);
    const isAuth = status === 401 || status === 403 || (!isAllProviders && /api key|permission|forbidden|unauthorized|invalid_api_key|PERMISSION_DENIED/i.test(msg));
    const isRate = status === 429 || /429|rate.?limit|RESOURCE_EXHAUSTED|quota exceeded|too many requests/i.test(msg);
    const isPayment = status === 402 || (!isAllProviders && /402|payment_required|billing|Insufficient Balance/i.test(msg));
    const code = isAllProviders
      ? "ALL_PROVIDERS_FAILED"
      : isMissingKey
        ? "MISSING_PROVIDER_KEY"
        : isAuth
          ? "INVALID_PROVIDER_KEY"
          : isRate
            ? "RATE_LIMITED"
            : isPayment
              ? "PAYMENT_REQUIRED"
              : "SERVICE_UNAVAILABLE";
    console.error("translate-text failed", { code, message: msg });
    // Always return 200 + fallback so the client never crashes the page.
    return new Response(
      JSON.stringify({
        error: msg,
        code,
        fallback: true,
        translation: "",
        translations: [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
