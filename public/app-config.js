// แก้ไฟล์นี้ได้หลัง deploy โดยไม่ต้อง build ใหม่
// ใช้เมื่อย้ายไป Supabase self-hosted (Linux) หรือเปลี่ยน backend
// ปล่อยว่างไว้ = ใช้ค่าจาก build environment (Vercel / Cloudflare / Lovable Cloud)
window.__BNG_CONFIG__ = {
  SUPABASE_URL: "",          // เช่น "https://db.myschool.ac.th"
  SUPABASE_ANON_KEY: "",     // anon / publishable key ของ instance นั้น
  SUPABASE_PROJECT_ID: "",
  STORAGE_PROVIDER: "",      // "" หรือ "supabase" = ใช้ Supabase Storage, "gdrive" = เก็บไฟล์บน Google Drive
};
