// แก้ไฟล์นี้ได้หลัง deploy โดยไม่ต้อง build ใหม่
// ใช้กำหนด backend หลักของระบบ (Supabase ของโรงเรียน) — ไม่พึ่ง Lovable Cloud
window.__BNG_CONFIG__ = {
  SUPABASE_URL: "https://gwmszzoqqxmejefhayqf.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_NlRn4zzOUtHsn4swyH6F7Q_ADVmUe9v",
  SUPABASE_PROJECT_ID: "gwmszzoqqxmejefhayqf",
  STORAGE_PROVIDER: "",      // "" หรือ "supabase" = ใช้ Supabase Storage, "gdrive" = เก็บไฟล์บน Google Drive
  // หมายเหตุ: ถ้าเลือก "gdrive" ต้องตั้ง secrets บน backend ปลายทาง
  //   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN / GOOGLE_DRIVE_FOLDER_ID
};
