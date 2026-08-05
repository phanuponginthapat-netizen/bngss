// แก้ไฟล์นี้ได้หลัง deploy โดยไม่ต้อง build ใหม่
// ใช้เมื่อย้ายไป Supabase self-hosted (Linux) หรือเปลี่ยน backend / เลิกใช้ Lovable Cloud
// ปล่อยว่างไว้ = ใช้ค่าจาก build environment
window.__BNG_CONFIG__ = {
  SUPABASE_URL: "",          // เช่น "https://db.myschool.ac.th"
  SUPABASE_ANON_KEY: "",     // anon / publishable key ของ instance นั้น
  SUPABASE_PROJECT_ID: "",
  STORAGE_PROVIDER: "",      // "" หรือ "supabase" = ใช้ Supabase Storage, "gdrive" = เก็บไฟล์บน Google Drive
  // หมายเหตุ: ถ้าเลือก "gdrive" ต้องตั้ง secrets บน backend ปลายทาง
  //   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN / GOOGLE_DRIVE_FOLDER_ID
};
