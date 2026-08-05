// ระบบนี้ใช้ backend ภายนอก (ไม่ใช่ Lovable Cloud) — client จริงอยู่ที่ appClient.ts
// ไฟล์นี้คงไว้เพื่อความเข้ากันได้ของ import เดิม และ re-export client แบบ runtime config
export {
  supabase,
  SUPABASE_RUNTIME_URL,
  SUPABASE_RUNTIME_ANON_KEY,
} from './appClient';
