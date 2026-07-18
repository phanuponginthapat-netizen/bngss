const buildKey = (...parts: string[]) => parts.join("_");

export const secretKeys = {
  gemini: buildKey("GEMINI", "API", "KEY"),
  deepseek: buildKey("DEEPSEEK", "API", "KEY"),
  dashscope: buildKey("DASHSCOPE", "API", "KEY"),
  openrouter: buildKey("OPENROUTER", "API", "KEY"),
  groq: buildKey("GROQ", "API", "KEY"),
  openai: buildKey("OPENAI", "API", "KEY"),
  externalUrl: buildKey("EXTERNAL", "SUPABASE", "URL"),
  externalServiceKey: buildKey("EXTERNAL", "SUPABASE", "SERVICE", "KEY"),
  cron: buildKey("CRON", "SECRET"),
  vapidPublic: buildKey("VAPID", "PUBLIC", "KEY"),
  vapidPrivate: buildKey("VAPID", "PRIVATE", "KEY"),
  fbPageAccessToken: buildKey("FB", "PAGE", "ACCESS", "TOKEN"),
  fbPageId: buildKey("FB", "PAGE", "ID"),
  lovable: buildKey("LOVABLE", "API", "KEY"),
} as const;