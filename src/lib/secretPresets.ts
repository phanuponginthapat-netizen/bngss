// Categorized presets for the "Add New Secret" picker on SecretsManagementPage.
// Mirrors the AI-Providers style: user picks category → key → auto-fills name/description.
export type SecretPreset = {
  key: string;
  label: string;
  description: string;
  placeholder?: string;
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
      { key: "LINE_CHANNEL_ACCESS_TOKEN", label: "LINE Channel Access Token", description: "โทเคนส่งข้อความ Messaging API" },
      { key: "LINE_CHANNEL_SECRET", label: "LINE Channel Secret", description: "ตรวจสอบ signature webhook" },
      { key: "LINE_LOGIN_CHANNEL_ID", label: "LINE Login Channel ID", description: "สำหรับ LINE Login" },
      { key: "LINE_LOGIN_CHANNEL_SECRET", label: "LINE Login Channel Secret", description: "สำหรับ LINE Login" },
      { key: "LINE_LIFF_CHANNEL_ID", label: "LINE LIFF Channel ID", description: "สำหรับ LIFF app" },
    ],
  },
  {
    id: "social",
    label: "Social / Facebook",
    presets: [
      { key: "FACEBOOK_PAGE_TOKEN", label: "Facebook Page Access Token", description: "ดึงโพสต์เพจอัตโนมัติ" },
      { key: "FACEBOOK_APP_ID", label: "Facebook App ID", description: "Meta for Developers App" },
      { key: "FACEBOOK_APP_SECRET", label: "Facebook App Secret", description: "Meta for Developers App" },
    ],
  },
  {
    id: "push",
    label: "Push Notification (VAPID)",
    presets: [
      { key: "VAPID_PUBLIC_KEY", label: "VAPID Public Key", description: "Web Push public key" },
      { key: "VAPID_PRIVATE_KEY", label: "VAPID Private Key", description: "Web Push private key" },
      { key: "VAPID_SUBJECT", label: "VAPID Subject", description: "mailto:admin@school.com" },
    ],
  },
  {
    id: "notifications",
    label: "การแจ้งเตือน",
    presets: [
      { key: "GOOGLE_CHAT_WEBHOOK_URL", label: "Google Chat Webhook URL", description: "ส่งข้อความเข้า Space" },
      { key: "SLACK_WEBHOOK_URL", label: "Slack Incoming Webhook", description: "แจ้งเตือนเข้า Slack channel" },
      { key: "DISCORD_WEBHOOK_URL", label: "Discord Webhook URL", description: "แจ้งเตือนเข้า Discord" },
      { key: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token", description: "แจ้งเตือนผ่าน Telegram Bot" },
    ],
  },
  {
    id: "email",
    label: "Email",
    presets: [
      { key: "RESEND_API_KEY", label: "Resend API Key", description: "ส่งอีเมลผ่าน Resend" },
      { key: "SMTP_HOST", label: "SMTP Host", description: "เช่น smtp.gmail.com" },
      { key: "SMTP_USER", label: "SMTP Username", description: "อีเมลผู้ส่ง" },
      { key: "SMTP_PASSWORD", label: "SMTP Password", description: "App password" },
    ],
  },
  {
    id: "voice",
    label: "เสียง / TTS",
    presets: [
      { key: "ELEVENLABS_API_KEY", label: "ElevenLabs API Key", description: "Text-to-Speech คุณภาพสูง" },
    ],
  },
  {
    id: "payments",
    label: "การชำระเงิน",
    presets: [
      { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", description: "sk_live_ / sk_test_" },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Secret", description: "whsec_..." },
      { key: "OMISE_SECRET_KEY", label: "Omise Secret Key", description: "การชำระเงินไทย" },
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
