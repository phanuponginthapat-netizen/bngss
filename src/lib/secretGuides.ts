// Step-by-step guides for obtaining each secret value.
// Match by exact key, then by prefix.
export type SecretGuide = {
  title: string;
  url?: string;
  steps: string[];
};

const EXACT: Record<string, SecretGuide> = {
  OPENAI_API_KEY: {
    title: "OpenAI API Key",
    url: "https://platform.openai.com/api-keys",
    steps: [
      "เข้า https://platform.openai.com/api-keys",
      "ล็อกอินบัญชี OpenAI",
      "กด Create new secret key",
      "ตั้งชื่อ และคัดลอกค่า sk-... มาวางที่นี่",
    ],
  },
  GEMINI_API_KEY: {
    title: "Google Gemini API Key",
    url: "https://aistudio.google.com/app/apikey",
    steps: [
      "เข้า https://aistudio.google.com/app/apikey",
      "ล็อกอิน Google",
      "กด Create API key → เลือกโปรเจกต์",
      "คัดลอกค่ามาวาง",
    ],
  },
  LOVABLE_API_KEY: {
    title: "Lovable AI Gateway Key",
    steps: [
      "ปกติ Lovable สร้างให้อัตโนมัติ",
      "ถ้าหายให้ไปที่ Project Settings → Lovable AI → Rotate Key",
    ],
  },
  GROQ_API_KEY: {
    title: "Groq API Key (ฟรี, เร็วมาก)",
    url: "https://console.groq.com/keys",
    steps: [
      "เข้า https://console.groq.com/keys",
      "ล็อกอินด้วย Google/GitHub",
      "กด Create API Key → คัดลอกค่า gsk_... มาวาง",
      "Models ที่ใช้ได้ฟรี: llama-3.3-70b, mixtral, gemma2",
    ],
  },
  OPENROUTER_API_KEY: {
    title: "OpenRouter API Key",
    url: "https://openrouter.ai/keys",
    steps: [
      "เข้า https://openrouter.ai/keys → Create Key",
      "ค่าจะขึ้นต้น sk-or-v1-...",
      "ใช้ model ฟรีโดยเติม :free เช่น meta-llama/llama-3.3-70b-instruct:free",
    ],
  },
  DEEPSEEK_API_KEY: {
    title: "DeepSeek API Key",
    url: "https://platform.deepseek.com/api_keys",
    steps: ["เข้า platform.deepseek.com → API Keys → Create → คัดลอก sk-..."],
  },
  MISTRAL_API_KEY: {
    title: "Mistral AI API Key",
    url: "https://console.mistral.ai/api-keys",
    steps: ["console.mistral.ai → API Keys → Create new key → คัดลอก"],
  },
  COHERE_API_KEY: {
    title: "Cohere API Key (ฟรี trial)",
    url: "https://dashboard.cohere.com/api-keys",
    steps: ["dashboard.cohere.com → API Keys → ใช้ Trial key (ฟรี rate-limited)"],
  },
  HUGGINGFACE_API_KEY: {
    title: "Hugging Face Access Token",
    url: "https://huggingface.co/settings/tokens",
    steps: [
      "huggingface.co → Settings → Access Tokens",
      "New token → Read → Create → คัดลอก hf_...",
    ],
  },
  TOGETHER_API_KEY: {
    title: "Together AI API Key",
    url: "https://api.together.xyz/settings/api-keys",
    steps: ["api.together.xyz → Settings → API Keys → Create"],
  },
  CEREBRAS_API_KEY: {
    title: "Cerebras Cloud API Key (เร็วที่สุด, ฟรี)",
    url: "https://cloud.cerebras.ai/",
    steps: ["cloud.cerebras.ai → API Keys → Create Secret Key"],
  },
  SAMBANOVA_API_KEY: {
    title: "SambaNova Cloud API Key",
    url: "https://cloud.sambanova.ai/apis",
    steps: ["cloud.sambanova.ai → APIs → Generate new API key"],
  },
  GLM_API_KEY: {
    title: "ZhipuAI GLM API Key (GLM-4-Flash ฟรีถาวร)",
    url: "https://open.bigmodel.cn/usercenter/apikeys",
    steps: [
      "สมัคร bigmodel.cn (จีน — ใช้เบอร์มือถือ)",
      "User Center → API Keys → คัดลอก",
    ],
  },
  DASHSCOPE_API_KEY: {
    title: "Alibaba DashScope (Qwen) API Key",
    url: "https://dashscope.console.aliyun.com/apiKey",
    steps: ["Alibaba Cloud → DashScope → API-KEY → Create"],
  },
  XAI_API_KEY: {
    title: "xAI Grok API Key",
    url: "https://console.x.ai/",
    steps: ["console.x.ai → API Keys → Create → xai-..."],
  },
  FIREWORKS_API_KEY: {
    title: "Fireworks AI API Key",
    url: "https://fireworks.ai/account/api-keys",
    steps: ["fireworks.ai → Account → API Keys → Create"],
  },
  NVIDIA_API_KEY: {
    title: "NVIDIA NIM API Key (ฟรี 1000 credits)",
    url: "https://build.nvidia.com/",
    steps: [
      "build.nvidia.com → เลือก model → Get API Key",
      "คัดลอก nvapi-...",
    ],
  },
  GITHUB_MODELS_TOKEN: {
    title: "GitHub Models Token (ฟรี ใช้ PAT)",
    url: "https://github.com/settings/tokens",
    steps: [
      "github.com/settings/tokens → Generate new token (classic)",
      "ไม่ต้องเลือก scope ก็ใช้ได้ → คัดลอก ghp_...",
      "Endpoint: https://models.inference.ai.azure.com",
    ],
  },
  PERPLEXITY_API_KEY: {
    title: "Perplexity API Key",
    url: "https://www.perplexity.ai/settings/api",
    steps: ["perplexity.ai → Settings → API → Generate"],
  },
  ANTHROPIC_API_KEY: {
    title: "Anthropic Claude API Key",
    url: "https://console.anthropic.com/settings/keys",
    steps: ["console.anthropic.com → Settings → API Keys → Create Key"],
  },
  LINE_CHANNEL_ACCESS_TOKEN: {
    title: "LINE Channel Access Token",
    url: "https://developers.line.biz/console/",
    steps: [
      "เข้า LINE Developers Console",
      "เลือก Provider → Messaging API channel ของโรงเรียน",
      "แท็บ Messaging API → Channel access token (long-lived) → Issue",
      "คัดลอกมาวาง",
    ],
  },
  LINE_CHANNEL_SECRET: {
    title: "LINE Channel Secret",
    url: "https://developers.line.biz/console/",
    steps: [
      "LINE Developers Console → Channel",
      "แท็บ Basic settings → Channel secret → Copy",
    ],
  },
  LINE_LOGIN_CHANNEL_ID: {
    title: "LINE Login Channel ID",
    url: "https://developers.line.biz/console/",
    steps: ["LINE Developers → LINE Login channel → Basic settings → Channel ID"],
  },
  LINE_LOGIN_CHANNEL_SECRET: {
    title: "LINE Login Channel Secret",
    url: "https://developers.line.biz/console/",
    steps: ["LINE Developers → LINE Login channel → Basic settings → Channel secret"],
  },
  LINE_LIFF_ID: {
    title: "LINE LIFF ID",
    url: "https://developers.line.biz/console/",
    steps: [
      "LINE Developers → LINE Login channel → LIFF tab",
      "Add ใหม่หรือเลือก LIFF app → คัดลอก LIFF ID",
    ],
  },
  GOOGLE_CHAT_WEBHOOK_URL: {
    title: "Google Chat Webhook URL",
    steps: [
      "เปิด Google Chat → Space ที่ต้องการ",
      "ชื่อ Space → Apps & integrations → Webhooks → Add webhook",
      "ตั้งชื่อ → คัดลอก URL",
    ],
  },
  VAPID_PRIVATE_KEY: {
    title: "VAPID Private Key (Web Push)",
    steps: [
      "รัน: npx web-push generate-vapid-keys",
      "คัดลอกค่า Private Key มาวาง",
      "Public Key ใส่ใน src/lib/pushSubscribe.ts",
    ],
  },
  FACEBOOK_PAGE_TOKEN: {
    title: "Facebook Page Access Token",
    url: "https://developers.facebook.com/tools/explorer/",
    steps: [
      "Meta for Developers → สร้าง App",
      "Graph API Explorer → เลือก Page → ขอ permission pages_read_engagement",
      "Generate Token → แลกเป็น Long-lived Page Token",
    ],
  },
  STRIPE_SECRET_KEY: {
    title: "Stripe Secret Key",
    url: "https://dashboard.stripe.com/apikeys",
    steps: ["Stripe Dashboard → Developers → API keys → Secret key (sk_live_/sk_test_)"],
  },
  RESEND_API_KEY: {
    title: "Resend API Key",
    url: "https://resend.com/api-keys",
    steps: ["resend.com → API Keys → Create API Key → คัดลอก"],
  },
};

const PREFIX: { prefix: string; guide: SecretGuide }[] = [
  { prefix: "LINE_", guide: { title: "LINE", url: "https://developers.line.biz/console/", steps: ["ดูที่ LINE Developers Console → channel ของคุณ"] } },
  { prefix: "OPENAI_", guide: EXACT.OPENAI_API_KEY },
  { prefix: "GEMINI_", guide: EXACT.GEMINI_API_KEY },
];

export function getSecretGuide(key: string): SecretGuide | null {
  if (EXACT[key]) return EXACT[key];
  for (const p of PREFIX) if (key.startsWith(p.prefix)) return p.guide;
  return null;
}
