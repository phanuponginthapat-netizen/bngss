// Categorized presets for the "Add New Secret" picker on SecretsManagementPage.
// เน้นบริการที่มี Free Tier ใช้งานได้จริงในโรงเรียน — เลือกหมวด → เลือก key → auto-fill
export type SecretPreset = {
  key: string;
  label: string;
  description: string;
  placeholder?: string;
  freeTier?: string; // สรุปโควต้าฟรี
};

export type SecretPresetCategory = {
  id: string;
  label: string;
  presets: SecretPreset[];
};

export const SECRET_PRESET_CATEGORIES: SecretPresetCategory[] = [
  {
    id: "line",
    label: "LINE",
    presets: [
      { key: "LINE_CHANNEL_ACCESS_TOKEN", label: "LINE Channel Access Token", description: "โทเคนส่งข้อความ Messaging API", freeTier: "ฟรี broadcast 200 ข้อความ/เดือน" },
      { key: "LINE_CHANNEL_SECRET", label: "LINE Channel Secret", description: "ตรวจสอบ signature webhook", freeTier: "ฟรี" },
      { key: "LINE_LOGIN_CHANNEL_ID", label: "LINE Login Channel ID", description: "สำหรับ LINE Login", freeTier: "ฟรีไม่จำกัด" },
      { key: "LINE_LOGIN_CHANNEL_SECRET", label: "LINE Login Channel Secret", description: "สำหรับ LINE Login", freeTier: "ฟรีไม่จำกัด" },
      { key: "LINE_LIFF_CHANNEL_ID", label: "LINE LIFF Channel ID", description: "สำหรับ LIFF app", freeTier: "ฟรีไม่จำกัด" },
      { key: "LINE_NOTIFY_TOKEN", label: "LINE Notify Token (Legacy)", description: "แจ้งเตือนส่วนตัว/กลุ่ม", freeTier: "ฟรี 1000 msg/ชม./token (หมดอายุ 2568)" },
    ],
  },
  {
    id: "social",
    label: "Social / Facebook",
    presets: [
      { key: "FACEBOOK_PAGE_TOKEN", label: "Facebook Page Access Token", description: "ดึงโพสต์เพจอัตโนมัติ", freeTier: "ฟรี (Graph API)" },
      { key: "FACEBOOK_APP_ID", label: "Facebook App ID", description: "Meta for Developers App", freeTier: "ฟรี" },
      { key: "FACEBOOK_APP_SECRET", label: "Facebook App Secret", description: "Meta for Developers App", freeTier: "ฟรี" },
      { key: "INSTAGRAM_ACCESS_TOKEN", label: "Instagram Basic Display Token", description: "ดึงโพสต์ IG", freeTier: "ฟรี (rate-limited)" },
      { key: "YOUTUBE_API_KEY", label: "YouTube Data API v3", description: "ดึงคลิปช่อง/playlist", freeTier: "ฟรี 10,000 units/วัน" },
      { key: "TIKTOK_CLIENT_KEY", label: "TikTok Developer Client Key", description: "TikTok Login Kit / Display API", freeTier: "ฟรี" },
    ],
  },
  {
    id: "push",
    label: "Push Notification (VAPID / FCM)",
    presets: [
      { key: "VAPID_PUBLIC_KEY", label: "VAPID Public Key", description: "Web Push public key", freeTier: "ฟรี (สร้างเอง)" },
      { key: "VAPID_PRIVATE_KEY", label: "VAPID Private Key", description: "Web Push private key", freeTier: "ฟรี (สร้างเอง)" },
      { key: "VAPID_SUBJECT", label: "VAPID Subject", description: "mailto:admin@school.com", freeTier: "ฟรี" },
      { key: "FCM_SERVER_KEY", label: "Firebase Cloud Messaging Server Key", description: "Push แจ้งเตือน Android/iOS/Web", freeTier: "ฟรีไม่จำกัด" },
      { key: "ONESIGNAL_APP_ID", label: "OneSignal App ID", description: "Push service ทางเลือก", freeTier: "ฟรี 10,000 web subs / unlimited mobile" },
      { key: "ONESIGNAL_REST_API_KEY", label: "OneSignal REST API Key", description: "ส่ง push จาก server", freeTier: "ฟรี" },
    ],
  },
  {
    id: "notifications",
    label: "การแจ้งเตือน / Chat",
    presets: [
      { key: "GOOGLE_CHAT_WEBHOOK_URL", label: "Google Chat Webhook URL", description: "ส่งข้อความเข้า Space", freeTier: "ฟรี (Google Workspace)" },
      { key: "SLACK_WEBHOOK_URL", label: "Slack Incoming Webhook", description: "แจ้งเตือนเข้า Slack channel", freeTier: "ฟรี" },
      { key: "DISCORD_WEBHOOK_URL", label: "Discord Webhook URL", description: "แจ้งเตือนเข้า Discord", freeTier: "ฟรีไม่จำกัด" },
      { key: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token", description: "แจ้งเตือนผ่าน Telegram Bot", freeTier: "ฟรีไม่จำกัด" },
      { key: "TELEGRAM_CHAT_ID", label: "Telegram Chat ID", description: "ID ห้อง/กลุ่มปลายทาง", freeTier: "ฟรี" },
      { key: "NTFY_TOPIC_URL", label: "ntfy.sh Topic URL", description: "Push แจ้งเตือนแบบเปิด", freeTier: "ฟรี self-host ได้" },
      { key: "PUSHOVER_APP_TOKEN", label: "Pushover App Token", description: "Push ไปมือถือ", freeTier: "ฟรี 10,000 msg/เดือน (ซื้อครั้งเดียว $5)" },
    ],
  },
  {
    id: "email",
    label: "Email (SMTP / API)",
    presets: [
      { key: "RESEND_API_KEY", label: "Resend API Key", description: "ส่งอีเมล API สมัยใหม่", freeTier: "ฟรี 3,000/เดือน, 100/วัน" },
      { key: "SENDGRID_API_KEY", label: "SendGrid API Key", description: "SMTP + Marketing", freeTier: "ฟรี 100/วันตลอดชีพ" },
      { key: "MAILGUN_API_KEY", label: "Mailgun API Key", description: "Transactional email", freeTier: "ฟรี 100/วัน (Flex)" },
      { key: "BREVO_API_KEY", label: "Brevo (Sendinblue) API Key", description: "Email + SMS", freeTier: "ฟรี 300/วัน" },
      { key: "POSTMARK_API_TOKEN", label: "Postmark Server Token", description: "Transactional เท่านั้น", freeTier: "ฟรี 100/เดือน" },
      { key: "SMTP_HOST", label: "SMTP Host", description: "เช่น smtp.gmail.com", freeTier: "Gmail: 500/วัน" },
      { key: "SMTP_USER", label: "SMTP Username", description: "อีเมลผู้ส่ง", freeTier: "-" },
      { key: "SMTP_PASSWORD", label: "SMTP Password", description: "App password", freeTier: "-" },
    ],
  },
  {
    id: "sms",
    label: "SMS / OTP",
    presets: [
      { key: "TWILIO_ACCOUNT_SID", label: "Twilio Account SID", description: "SMS/Voice/WhatsApp", freeTier: "$15 trial credit" },
      { key: "TWILIO_AUTH_TOKEN", label: "Twilio Auth Token", description: "คู่กับ SID", freeTier: "-" },
      { key: "THAIBULKSMS_API_KEY", label: "ThaiBulkSMS API Key", description: "SMS ในไทย ส่งชื่อได้", freeTier: "ทดลอง 10 SMS" },
      { key: "VONAGE_API_KEY", label: "Vonage (Nexmo) API Key", description: "SMS ต่างประเทศ", freeTier: "€2 trial" },
    ],
  },
  {
    id: "storage",
    label: "Storage / CDN",
    presets: [
      { key: "CLOUDINARY_URL", label: "Cloudinary URL", description: "Image/Video CDN + transform", freeTier: "ฟรี 25 credits/เดือน" },
      { key: "IMGBB_API_KEY", label: "ImgBB API Key", description: "อัปโหลดรูปฟรี", freeTier: "ฟรีไม่จำกัด" },
      { key: "UPLOADCARE_PUBLIC_KEY", label: "Uploadcare Public Key", description: "File upload widget", freeTier: "ฟรี 3GB traffic/เดือน" },
      { key: "BUNNY_STORAGE_ZONE", label: "Bunny.net Storage Zone", description: "CDN ราคาถูก", freeTier: "$1 credit" },
      { key: "R2_ACCESS_KEY_ID", label: "Cloudflare R2 Access Key", description: "S3-compatible ไม่มีค่า egress", freeTier: "ฟรี 10GB storage" },
    ],
  },
  {
    id: "maps",
    label: "แผนที่ / Location",
    presets: [
      { key: "GOOGLE_MAPS_API_KEY", label: "Google Maps API Key", description: "Maps/Places/Geocoding", freeTier: "ฟรี $200 credit/เดือน" },
      { key: "MAPBOX_ACCESS_TOKEN", label: "Mapbox Access Token", description: "แผนที่สวย custom style", freeTier: "ฟรี 50,000 loads/เดือน" },
      { key: "OPENCAGE_API_KEY", label: "OpenCage Geocoding", description: "Geocoding ทางเลือก", freeTier: "ฟรี 2,500/วัน" },
      { key: "LONGDO_MAP_KEY", label: "Longdo Map API Key", description: "แผนที่ไทย NOSTRA", freeTier: "ฟรีสำหรับใช้ทั่วไป" },
    ],
  },
  {
    id: "weather",
    label: "สภาพอากาศ",
    presets: [
      { key: "OPENWEATHER_API_KEY", label: "OpenWeather API Key", description: "พยากรณ์อากาศ", freeTier: "ฟรี 1,000 calls/วัน" },
      { key: "WEATHERAPI_KEY", label: "WeatherAPI.com Key", description: "อากาศ + astronomy", freeTier: "ฟรี 1M calls/เดือน" },
      { key: "TOMORROW_IO_API_KEY", label: "Tomorrow.io API Key", description: "อากาศแม่นยำสูง", freeTier: "ฟรี 500 calls/วัน" },
      { key: "TMD_API_TOKEN", label: "กรมอุตุนิยมวิทยา (TMD) Token", description: "ข้อมูลอากาศไทยทางการ", freeTier: "ฟรีสำหรับหน่วยงาน" },
    ],
  },
  {
    id: "voice",
    label: "เสียง / TTS / STT",
    presets: [
      { key: "ELEVENLABS_API_KEY", label: "ElevenLabs API Key", description: "Text-to-Speech คุณภาพสูง", freeTier: "ฟรี 10,000 chars/เดือน" },
      { key: "DEEPGRAM_API_KEY", label: "Deepgram STT Key", description: "Speech-to-Text เร็ว", freeTier: "ฟรี $200 credit" },
      { key: "ASSEMBLYAI_API_KEY", label: "AssemblyAI Key", description: "STT + Speaker diarization", freeTier: "ฟรี $50 credit" },
      { key: "AZURE_SPEECH_KEY", label: "Azure Speech Key", description: "TTS/STT ครบ รองรับไทย", freeTier: "ฟรี 500,000 chars/เดือน" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics / Error Tracking",
    presets: [
      { key: "SENTRY_DSN", label: "Sentry DSN", description: "รับ error frontend/backend", freeTier: "ฟรี 5,000 errors/เดือน" },
      { key: "POSTHOG_API_KEY", label: "PostHog API Key", description: "Product analytics", freeTier: "ฟรี 1M events/เดือน" },
      { key: "PLAUSIBLE_API_KEY", label: "Plausible Analytics", description: "Privacy-first analytics", freeTier: "ทดลอง 30 วัน / self-host ฟรี" },
      { key: "UMAMI_API_KEY", label: "Umami Analytics", description: "Open-source analytics", freeTier: "ฟรี (cloud/self-host)" },
      { key: "GA_MEASUREMENT_ID", label: "Google Analytics 4 ID", description: "GA4 Measurement ID", freeTier: "ฟรีไม่จำกัด" },
    ],
  },
  {
    id: "captcha",
    label: "CAPTCHA / Anti-bot",
    presets: [
      { key: "RECAPTCHA_SITE_KEY", label: "Google reCAPTCHA Site Key", description: "v2/v3 กัน bot", freeTier: "ฟรี 1M assessments/เดือน" },
      { key: "RECAPTCHA_SECRET_KEY", label: "Google reCAPTCHA Secret", description: "ตรวจสอบ server-side", freeTier: "ฟรี" },
      { key: "TURNSTILE_SITE_KEY", label: "Cloudflare Turnstile Site Key", description: "ไม่ต้อง challenge", freeTier: "ฟรีไม่จำกัด" },
      { key: "TURNSTILE_SECRET_KEY", label: "Cloudflare Turnstile Secret", description: "verify ฝั่ง server", freeTier: "ฟรี" },
      { key: "HCAPTCHA_SITE_KEY", label: "hCaptcha Site Key", description: "ทางเลือก reCAPTCHA", freeTier: "ฟรี 1M/เดือน" },
    ],
  },
  {
    id: "payments",
    label: "การชำระเงิน",
    presets: [
      { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", description: "sk_live_ / sk_test_", freeTier: "ไม่มีค่าเริ่มต้น คิด % ต่อรายการ" },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Secret", description: "whsec_...", freeTier: "ฟรี" },
      { key: "OMISE_SECRET_KEY", label: "Omise Secret Key", description: "การชำระเงินไทย", freeTier: "ทดสอบฟรี" },
      { key: "PROMPTPAY_ID", label: "PromptPay ID", description: "เบอร์/เลขบัตร/นิติบุคคล สร้าง QR", freeTier: "ฟรี" },
    ],
  },
  {
    id: "general",
    label: "ทั่วไป (กำหนดเอง)",
    presets: [
      { key: "", label: "กำหนดเอง...", description: "ใส่ชื่อ UPPER_SNAKE_CASE เอง" },
    ],
  },
];
