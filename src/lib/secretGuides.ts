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
