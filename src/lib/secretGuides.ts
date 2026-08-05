// Step-by-step guides for obtaining each secret value.
// Match by exact key, then by prefix.
export type SecretGuide = {
  title: string;
  url?: string;
  steps: string[];
  freeTier?: string;
};

const EXACT: Record<string, SecretGuide> = {
  // ============ AI (kept for compat, main list moved to AI Providers) ============
  OPENAI_API_KEY: { title: "OpenAI API Key", url: "https://platform.openai.com/api-keys", steps: ["เข้า platform.openai.com/api-keys", "Create new secret key", "คัดลอก sk-..."] },
  GEMINI_API_KEY: { title: "Google Gemini API Key", url: "https://aistudio.google.com/app/apikey", freeTier: "ฟรี Gemini 2.5 Flash 15 RPM", steps: ["เข้า aistudio.google.com/app/apikey", "Create API key"] },
  GOOGLE_OAUTH_CLIENT_ID: { title: "Google OAuth Client ID", steps: ["เปิด Google Cloud Console → APIs & Services → Credentials", "สร้าง OAuth client ID (Web application)", "ใส่ Authorized redirect URI = {SUPABASE_URL}/functions/v1/gdrive-connect-finish"] },
  GOOGLE_OAUTH_CLIENT_SECRET: { title: "Google OAuth Client Secret", steps: ["คัดลอกจาก OAuth client เดียวกันกับ Client ID"] },
  GOOGLE_SERVICE_ACCOUNT_JSON: { title: "Google Service Account (สำหรับ Drive ระบบ)", steps: ["Google Cloud Console → IAM → Service Accounts", "สร้าง key แบบ JSON แล้ววางทั้งไฟล์", "แชร์โฟลเดอร์ Drive ให้อีเมล service account"] },
  GROQ_API_KEY: { title: "Groq API Key", url: "https://console.groq.com/keys", freeTier: "ฟรี rate-limited (llama-3.3-70b, mixtral)", steps: ["console.groq.com/keys", "Create API Key → gsk_..."] },
  OPENROUTER_API_KEY: { title: "OpenRouter API Key", url: "https://openrouter.ai/keys", freeTier: "ฟรีบาง model ที่ลงท้าย :free", steps: ["openrouter.ai/keys → Create Key"] },

  // ============ LINE ============
  LINE_CHANNEL_ACCESS_TOKEN: {
    title: "LINE Channel Access Token",
    url: "https://developers.line.biz/console/",
    freeTier: "ฟรี broadcast 200 ข้อความ/เดือน + reply ไม่จำกัด",
    steps: [
      "เข้า LINE Developers Console",
      "เลือก Provider → Messaging API channel",
      "แท็บ Messaging API → Channel access token (long-lived) → Issue",
      "คัดลอกมาวาง",
    ],
  },
  LINE_CHANNEL_SECRET: { title: "LINE Channel Secret", url: "https://developers.line.biz/console/", steps: ["LINE Developers → Channel → Basic settings → Channel secret → Copy"] },
  LINE_LOGIN_CHANNEL_ID: { title: "LINE Login Channel ID", url: "https://developers.line.biz/console/", steps: ["LINE Developers → LINE Login channel → Basic → Channel ID"] },
  LINE_LOGIN_CHANNEL_SECRET: { title: "LINE Login Channel Secret", url: "https://developers.line.biz/console/", steps: ["LINE Developers → LINE Login channel → Basic → Channel secret"] },
  LINE_LIFF_CHANNEL_ID: { title: "LINE LIFF ID", url: "https://developers.line.biz/console/", steps: ["LINE Developers → LINE Login channel → LIFF tab → Add → คัดลอก LIFF ID"] },
  LINE_LIFF_ID: { title: "LINE LIFF ID", url: "https://developers.line.biz/console/", steps: ["LINE Developers → LINE Login channel → LIFF tab → Add → คัดลอก LIFF ID"] },
  LINE_NOTIFY_TOKEN: {
    title: "LINE Notify Token (Legacy)",
    url: "https://notify-bot.line.me/my/",
    freeTier: "ฟรี 1000 msg/ชม./token (บริการหมดอายุ 31 มี.ค. 2568)",
    steps: ["notify-bot.line.me/my → Generate token", "เลือกห้อง/1-on-1 → คัดลอก"],
  },

  // ============ Social ============
  FACEBOOK_PAGE_TOKEN: {
    title: "Facebook Page Access Token",
    url: "https://developers.facebook.com/tools/explorer/",
    steps: ["Meta for Developers → สร้าง App", "Graph API Explorer → เลือก Page → permission pages_read_engagement", "Generate Token → แลกเป็น Long-lived Page Token"],
  },
  FACEBOOK_APP_ID: { title: "Facebook App ID", url: "https://developers.facebook.com/apps/", steps: ["สร้าง App → App ID อยู่ด้านบน"] },
  FACEBOOK_APP_SECRET: { title: "Facebook App Secret", url: "https://developers.facebook.com/apps/", steps: ["App → Settings → Basic → App Secret → Show"] },
  INSTAGRAM_ACCESS_TOKEN: {
    title: "Instagram Basic Display Token",
    url: "https://developers.facebook.com/",
    steps: ["Meta for Developers → App → Instagram Basic Display", "Add Instagram Test User → Generate Token"],
  },
  YOUTUBE_API_KEY: {
    title: "YouTube Data API v3",
    url: "https://console.cloud.google.com/apis/credentials",
    freeTier: "ฟรี 10,000 units/วัน (~100 requests)",
    steps: ["Google Cloud Console → APIs → Enable YouTube Data API v3", "Credentials → Create Credentials → API key"],
  },
  TIKTOK_CLIENT_KEY: {
    title: "TikTok Developer Client Key",
    url: "https://developers.tiktok.com/",
    steps: ["developers.tiktok.com → Manage apps → สร้าง app", "คัดลอก Client Key"],
  },

  // ============ Push ============
  VAPID_PUBLIC_KEY: { title: "VAPID Public Key", steps: ["รัน: npx web-push generate-vapid-keys", "ระบบสร้างให้อัตโนมัติเมื่อ Remix"] },
  VAPID_PRIVATE_KEY: { title: "VAPID Private Key", steps: ["รัน: npx web-push generate-vapid-keys", "ระบบสร้างให้อัตโนมัติเมื่อ Remix"] },
  VAPID_SUBJECT: { title: "VAPID Subject", steps: ["ใส่ mailto:admin@school.com หรือ URL เว็บ"] },
  FCM_SERVER_KEY: {
    title: "Firebase Cloud Messaging Server Key",
    url: "https://console.firebase.google.com/",
    freeTier: "ฟรีไม่จำกัด",
    steps: ["Firebase Console → สร้าง Project", "Project Settings → Cloud Messaging → Server key (Legacy)"],
  },
  ONESIGNAL_APP_ID: { title: "OneSignal App ID", url: "https://dashboard.onesignal.com/", freeTier: "ฟรี 10,000 web subs / unlimited mobile", steps: ["OneSignal Dashboard → New App", "Settings → Keys & IDs → OneSignal App ID"] },
  ONESIGNAL_REST_API_KEY: { title: "OneSignal REST API Key", url: "https://dashboard.onesignal.com/", steps: ["Settings → Keys & IDs → REST API Key"] },

  // ============ Notifications / Chat ============
  GOOGLE_CHAT_WEBHOOK_URL: { title: "Google Chat Webhook URL", steps: ["Google Chat → Space → Apps & integrations → Webhooks → Add", "คัดลอก URL"] },
  SLACK_WEBHOOK_URL: {
    title: "Slack Incoming Webhook",
    url: "https://api.slack.com/apps",
    steps: ["api.slack.com/apps → Create New App → From scratch", "Incoming Webhooks → Activate → Add New Webhook to Workspace", "เลือก channel → คัดลอก URL https://hooks.slack.com/..."],
  },
  DISCORD_WEBHOOK_URL: {
    title: "Discord Webhook URL",
    freeTier: "ฟรีไม่จำกัด",
    steps: ["Discord → Server Settings → Integrations → Webhooks", "New Webhook → เลือก channel → Copy Webhook URL"],
  },
  TELEGRAM_BOT_TOKEN: {
    title: "Telegram Bot Token",
    freeTier: "ฟรีไม่จำกัด",
    steps: ["เปิด Telegram → chat กับ @BotFather", "/newbot → ตั้งชื่อ → รับ token 123456:ABC..."],
  },
  TELEGRAM_CHAT_ID: {
    title: "Telegram Chat ID",
    steps: ["ส่งข้อความให้ bot ก่อน", "เปิด https://api.telegram.org/bot<TOKEN>/getUpdates", "ดู chat.id ใน JSON"],
  },
  NTFY_TOPIC_URL: {
    title: "ntfy.sh Topic URL",
    url: "https://ntfy.sh",
    freeTier: "ฟรี self-host ได้",
    steps: ["คิด topic name ยากๆ เช่น bng-school-abc123", "URL คือ https://ntfy.sh/<topic>", "ติดตั้งแอป ntfy บนมือถือ → Subscribe topic"],
  },
  PUSHOVER_APP_TOKEN: { title: "Pushover App Token", url: "https://pushover.net/apps/build", freeTier: "ซื้อครั้งเดียว $5, ส่งได้ 10k/เดือน", steps: ["pushover.net → Create Application → คัดลอก API Token"] },

  // ============ Email ============
  RESEND_API_KEY: { title: "Resend API Key", url: "https://resend.com/api-keys", freeTier: "ฟรี 3,000/เดือน · 100/วัน", steps: ["resend.com → API Keys → Create API Key → re_..."] },
  SENDGRID_API_KEY: { title: "SendGrid API Key", url: "https://app.sendgrid.com/settings/api_keys", freeTier: "ฟรี 100/วัน ตลอดชีพ", steps: ["SendGrid → Settings → API Keys → Create → Full Access → SG...."] },
  MAILGUN_API_KEY: { title: "Mailgun API Key", url: "https://app.mailgun.com/settings/api_security", freeTier: "ฟรี 100/วัน (Flex plan)", steps: ["Mailgun → Settings → API Security → API Keys"] },
  BREVO_API_KEY: { title: "Brevo (Sendinblue) API Key", url: "https://app.brevo.com/settings/keys/api", freeTier: "ฟรี 300 email/วัน + SMS", steps: ["Brevo → SMTP & API → API Keys → Generate a new API key"] },
  POSTMARK_API_TOKEN: { title: "Postmark Server Token", url: "https://account.postmarkapp.com/servers", freeTier: "ฟรี 100/เดือน", steps: ["Postmark → Server → API Tokens → Copy Server Token"] },
  SMTP_HOST: { title: "SMTP Host", steps: ["Gmail: smtp.gmail.com:587 (TLS)", "Outlook: smtp.office365.com:587", "โฮสต์อื่นดูในคู่มืออีเมล"] },
  SMTP_USER: { title: "SMTP Username", steps: ["ปกติคืออีเมลผู้ส่ง เช่น admin@school.com"] },
  SMTP_PASSWORD: { title: "SMTP Password (App Password)", steps: ["Gmail: myaccount.google.com/apppasswords → สร้าง App password 16 หลัก", "ห้ามใช้รหัสผ่านปกติ"] },

  // ============ SMS ============
  TWILIO_ACCOUNT_SID: { title: "Twilio Account SID", url: "https://console.twilio.com/", freeTier: "$15 trial credit", steps: ["console.twilio.com → หน้าแรก → Account SID"] },
  TWILIO_AUTH_TOKEN: { title: "Twilio Auth Token", url: "https://console.twilio.com/", steps: ["console.twilio.com → Auth Token → Show → Copy"] },
  THAIBULKSMS_API_KEY: { title: "ThaiBulkSMS API Key", url: "https://www.thaibulksms.com/", freeTier: "ทดลอง 10 SMS", steps: ["สมัคร thaibulksms.com → Dashboard → Settings → API Key"] },
  VONAGE_API_KEY: { title: "Vonage API Key", url: "https://dashboard.nexmo.com/", freeTier: "€2 trial credit", steps: ["dashboard.nexmo.com → API key & secret"] },

  // ============ Storage ============
  CLOUDINARY_URL: { title: "Cloudinary URL", url: "https://cloudinary.com/console", freeTier: "ฟรี 25 credits/เดือน (~25GB)", steps: ["cloudinary.com/console → Dashboard → Account Details", "คัดลอก CLOUDINARY_URL=cloudinary://key:secret@cloud"] },
  IMGBB_API_KEY: { title: "ImgBB API Key", url: "https://api.imgbb.com/", freeTier: "ฟรีไม่จำกัด (public images)", steps: ["สมัคร imgbb.com → api.imgbb.com → Get API key"] },
  UPLOADCARE_PUBLIC_KEY: { title: "Uploadcare Public Key", url: "https://uploadcare.com/", freeTier: "ฟรี 3GB traffic/เดือน", steps: ["uploadcare.com → Dashboard → Project → Public Key"] },
  BUNNY_STORAGE_ZONE: { title: "Bunny.net Storage Zone", url: "https://dash.bunny.net/", freeTier: "$1 trial", steps: ["Bunny.net → Storage → Add Storage Zone → Copy zone name + password"] },
  R2_ACCESS_KEY_ID: { title: "Cloudflare R2 Access Key", url: "https://dash.cloudflare.com/", freeTier: "ฟรี 10GB storage · ไม่มี egress fee", steps: ["Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token"] },

  // ============ Maps ============
  GOOGLE_MAPS_API_KEY: { title: "Google Maps API Key", url: "https://console.cloud.google.com/google/maps-apis", freeTier: "ฟรี $200 credit/เดือน", steps: ["Google Cloud → Maps Platform → Credentials → Create API key", "Enable Maps/Places/Geocoding APIs"] },
  MAPBOX_ACCESS_TOKEN: { title: "Mapbox Access Token", url: "https://account.mapbox.com/access-tokens/", freeTier: "ฟรี 50,000 map loads/เดือน", steps: ["Mapbox → Account → Access tokens → Create a token"] },
  OPENCAGE_API_KEY: { title: "OpenCage Geocoding", url: "https://opencagedata.com/dashboard", freeTier: "ฟรี 2,500 requests/วัน", steps: ["opencagedata.com → Dashboard → API Keys"] },
  LONGDO_MAP_KEY: { title: "Longdo Map API Key", url: "https://map.longdo.com/console", freeTier: "ฟรีใช้งานทั่วไป", steps: ["map.longdo.com/console → API Key → สร้าง key"] },

  // ============ Weather ============
  OPENWEATHER_API_KEY: { title: "OpenWeather API Key", url: "https://home.openweathermap.org/api_keys", freeTier: "ฟรี 1,000 calls/วัน · 60/min", steps: ["สมัคร openweathermap.org → API keys → Copy default key", "รอ ~2 ชม. ให้ key active"] },
  WEATHERAPI_KEY: { title: "WeatherAPI.com Key", url: "https://www.weatherapi.com/my/", freeTier: "ฟรี 1M calls/เดือน", steps: ["สมัคร weatherapi.com → My Account → API Key"] },
  TOMORROW_IO_API_KEY: { title: "Tomorrow.io API Key", url: "https://app.tomorrow.io/development/keys", freeTier: "ฟรี 500 calls/วัน · 25/hr", steps: ["Tomorrow.io → Development → API Keys"] },
  TMD_API_TOKEN: { title: "กรมอุตุนิยมวิทยา TMD", url: "https://data.tmd.go.th/", freeTier: "ฟรีสำหรับหน่วยงานราชการ/การศึกษา", steps: ["data.tmd.go.th → สมัครหน่วยงาน → รอ approve → Token"] },

  // ============ Voice / TTS ============
  ELEVENLABS_API_KEY: { title: "ElevenLabs API Key", url: "https://elevenlabs.io/app/settings/api-keys", freeTier: "ฟรี 10,000 chars/เดือน", steps: ["elevenlabs.io → Profile → API Keys → Create"] },
  DEEPGRAM_API_KEY: { title: "Deepgram API Key", url: "https://console.deepgram.com/", freeTier: "ฟรี $200 credit", steps: ["console.deepgram.com → API Keys → Create Key"] },
  ASSEMBLYAI_API_KEY: { title: "AssemblyAI API Key", url: "https://www.assemblyai.com/app", freeTier: "ฟรี $50 credit", steps: ["assemblyai.com/app → Copy API Key"] },
  AZURE_SPEECH_KEY: { title: "Azure Speech Key", url: "https://portal.azure.com/", freeTier: "ฟรี 500,000 chars/เดือน (F0 tier)", steps: ["Azure Portal → Create resource → Speech Services", "เลือก F0 (free) → Keys and Endpoint → Key 1"] },

  // ============ Analytics ============
  SENTRY_DSN: { title: "Sentry DSN", url: "https://sentry.io/", freeTier: "ฟรี 5,000 errors/เดือน", steps: ["sentry.io → Create Project → Settings → Client Keys (DSN)"] },
  POSTHOG_API_KEY: { title: "PostHog API Key", url: "https://app.posthog.com/project/settings", freeTier: "ฟรี 1M events/เดือน · 5k session recordings", steps: ["PostHog → Project Settings → Project API Key"] },
  PLAUSIBLE_API_KEY: { title: "Plausible Analytics", url: "https://plausible.io/", freeTier: "Self-host ฟรี · Cloud ทดลอง 30 วัน", steps: ["plausible.io → Settings → API Keys"] },
  UMAMI_API_KEY: { title: "Umami Analytics", url: "https://cloud.umami.is/", freeTier: "ฟรี (cloud & self-host)", steps: ["cloud.umami.is → Settings → API Keys"] },
  GA_MEASUREMENT_ID: { title: "Google Analytics 4", url: "https://analytics.google.com/", freeTier: "ฟรีไม่จำกัด", steps: ["Google Analytics → Admin → Data Streams → Web → Measurement ID (G-XXXX)"] },

  // ============ CAPTCHA ============
  RECAPTCHA_SITE_KEY: { title: "Google reCAPTCHA v3", url: "https://www.google.com/recaptcha/admin", freeTier: "ฟรี 1M assessments/เดือน", steps: ["google.com/recaptcha/admin → + สร้าง site → เลือก v3", "เพิ่ม domain → Site key"] },
  RECAPTCHA_SECRET_KEY: { title: "Google reCAPTCHA Secret", url: "https://www.google.com/recaptcha/admin", steps: ["หน้าเดียวกับ Site key → Secret Key"] },
  TURNSTILE_SITE_KEY: { title: "Cloudflare Turnstile", url: "https://dash.cloudflare.com/?to=/:account/turnstile", freeTier: "ฟรีไม่จำกัด · ไม่ต้อง challenge ผู้ใช้", steps: ["Cloudflare Dashboard → Turnstile → Add site → Site Key"] },
  TURNSTILE_SECRET_KEY: { title: "Cloudflare Turnstile Secret", url: "https://dash.cloudflare.com/?to=/:account/turnstile", steps: ["Turnstile → site เดิม → Secret Key"] },
  HCAPTCHA_SITE_KEY: { title: "hCaptcha", url: "https://dashboard.hcaptcha.com/", freeTier: "ฟรี 1M/เดือน", steps: ["hcaptcha.com → Dashboard → Sites → New Site → Site Key"] },

  // ============ Payments ============
  STRIPE_SECRET_KEY: { title: "Stripe Secret Key", url: "https://dashboard.stripe.com/apikeys", steps: ["Stripe → Developers → API keys → Secret key (sk_test_/sk_live_)"] },
  STRIPE_WEBHOOK_SECRET: { title: "Stripe Webhook Secret", url: "https://dashboard.stripe.com/webhooks", steps: ["Stripe → Developers → Webhooks → Add endpoint → Signing secret whsec_..."] },
  OMISE_SECRET_KEY: { title: "Omise Secret Key", url: "https://dashboard.omise.co/", steps: ["Omise Dashboard → Keys → Secret key"] },
  PROMPTPAY_ID: { title: "PromptPay ID", steps: ["เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก หรือเลขนิติบุคคล 13 หลัก", "ระบบใช้สร้าง QR รับเงิน"] },

  // ============ Misc AI (kept) ============
  DEEPSEEK_API_KEY: { title: "DeepSeek API Key", url: "https://platform.deepseek.com/api_keys", steps: ["platform.deepseek.com → API Keys → Create"] },
  MISTRAL_API_KEY: { title: "Mistral AI", url: "https://console.mistral.ai/api-keys", steps: ["console.mistral.ai → API Keys → Create"] },
  COHERE_API_KEY: { title: "Cohere", url: "https://dashboard.cohere.com/api-keys", freeTier: "ฟรี Trial rate-limited", steps: ["dashboard.cohere.com → API Keys"] },
  HUGGINGFACE_API_KEY: { title: "Hugging Face Token", url: "https://huggingface.co/settings/tokens", steps: ["huggingface.co → Settings → Access Tokens → Read"] },
  DASHSCOPE_API_KEY: { title: "Alibaba DashScope (Qwen)", url: "https://dashscope.console.aliyun.com/apiKey", steps: ["Alibaba Cloud → DashScope → API-KEY → Create"] },
  ANTHROPIC_API_KEY: { title: "Anthropic Claude", url: "https://console.anthropic.com/settings/keys", steps: ["console.anthropic.com → Settings → API Keys → Create Key"] },
};

const PREFIX: { prefix: string; guide: SecretGuide }[] = [
  { prefix: "LINE_", guide: { title: "LINE", url: "https://developers.line.biz/console/", steps: ["ดูที่ LINE Developers Console → channel ของคุณ"] } },
  { prefix: "SMTP_", guide: { title: "SMTP Server", steps: ["ดูข้อมูลจากผู้ให้บริการอีเมล", "Gmail ต้องใช้ App Password"] } },
  { prefix: "TWILIO_", guide: EXACT.TWILIO_ACCOUNT_SID },
  { prefix: "STRIPE_", guide: EXACT.STRIPE_SECRET_KEY },
  { prefix: "FACEBOOK_", guide: EXACT.FACEBOOK_PAGE_TOKEN },
  { prefix: "OPENAI_", guide: EXACT.OPENAI_API_KEY },
  { prefix: "GEMINI_", guide: EXACT.GEMINI_API_KEY },
];

export function getSecretGuide(key: string): SecretGuide | null {
  if (EXACT[key]) return EXACT[key];
  for (const p of PREFIX) if (key.startsWith(p.prefix)) return p.guide;
  return null;
}
