import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { OCR_MAX_BYTES, OCR_MAX_PAGES, OCR_TYPES, validateOcrResult } from "./policy.ts";

Deno.serve(async req => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "ไม่รองรับคำขอนี้" });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(503, { error: "ระบบอ่านเอกสารยังไม่พร้อม" });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "กรุณาเข้าสู่ระบบ" });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return json(401, { error: "กรุณาเข้าสู่ระบบใหม่" });
  const apiKey = Deno.env.get("IAPP_API_KEY");
  if (!apiKey) return json(503, { error: "ผู้ดูแลยังไม่ได้เชื่อมบัญชี iApp" });
  try {
    const length = Number(req.headers.get("content-length") || 0);
    if (length > OCR_MAX_BYTES + 65536) return json(413, { error: "ไฟล์ใหญ่เกิน 8MB" });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.name.length > 255 || !OCR_TYPES.includes(file.type)) return json(400, { error: "รองรับ PDF, JPEG, PNG, WebP และ BMP ที่ไม่ว่าง" });
    if (file.size > OCR_MAX_BYTES) return json(413, { error: "ไฟล์ใหญ่เกิน 8MB" });
    if (form.get("consent") !== "true") return json(400, { error: "กรุณายืนยันการส่งเอกสารไป iApp และค่าใช้จ่ายก่อน" });
    const bytes = new Uint8Array(await file.arrayBuffer());
    let pages = 1;
    if (file.type === "application/pdf") {
      try { pages = (await PDFDocument.load(bytes)).getPageCount(); }
      catch { return json(400, { error: "PDF เสียหายหรือมีรหัสผ่าน กรุณาตรวจไฟล์" }); }
    } else {
      const valid = file.type === "image/png" ? bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
        : file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : file.type === "image/bmp" ? bytes[0] === 66 && bytes[1] === 77
        : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      if (!valid) return json(400, { error: "ชนิดไฟล์ไม่ตรงกับเนื้อหา กรุณาตรวจไฟล์" });
    }
    if (pages < 1 || pages > OCR_MAX_PAGES) return json(413, { error: "เอกสารเกิน 50 หน้า กรุณาแบ่งไฟล์" });
    const upload = new FormData(); upload.append("file", file);
    const response = await fetch("https://api.iapp.co.th/v3/store/ocr/document/markdown", { method: "POST", headers: { apikey: apiKey }, body: upload, signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
      // Never return upstream bodies: they may contain document text or credentials.
      const messages: Record<number, string> = { 401: "คีย์ iApp ใช้งานไม่ได้ กรุณาแจ้งผู้ดูแล", 402: "เครดิต iApp ไม่เพียงพอ กรุณาแจ้งผู้ดูแล", 413: "เอกสารเกินขีดจำกัด iApp", 415: "iApp ไม่รองรับไฟล์นี้", 422: "iApp อ่านเอกสารไม่สำเร็จ", 429: "iApp มีคำขอมาก กรุณาลองใหม่ภายหลัง", 503: "iApp ไม่พร้อม กรุณาลองใหม่ภายหลัง" };
      return json(response.status, { error: messages[response.status] || `iApp อ่านเอกสารไม่สำเร็จ (${response.status})`, providerStatus: response.status });
    }
    const result = validateOcrResult(await response.json(), pages);
    return json(200, { name: file.name, ...result });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return json(504, { error: "iApp ใช้เวลานานเกินไป อาจมีค่าอ่านเกิดขึ้นแล้ว กรุณาตรวจการใช้งานก่อนลองใหม่" });
    return json(422, { error: error instanceof Error && /อ่าน|ข้อความ|เนื้อหา/.test(error.message) ? error.message : "อ่านเอกสารไม่สำเร็จ กรุณาตรวจไฟล์แล้วลองใหม่" });
  }
});