// Supabase client ที่อ่านค่าแบบ runtime (รองรับ self-hosted / เปลี่ยน backend หลัง deploy)
// ไฟล์นี้ถูก alias ให้แทนที่ "@/integrations/supabase/client" ทั้งระบบ (ดู vite.config.ts)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getBackendConfig } from '@/lib/runtimeConfig';

const cfg = getBackendConfig();

const SUPABASE_URL = cfg.url;
const SUPABASE_PUBLISHABLE_KEY = cfg.anonKey;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // ไม่ throw เพื่อให้หน้า /setup ยังเปิดได้และตั้งค่าใหม่ได้
  console.warn('[backend] ยังไม่ได้ตั้งค่า Supabase URL / anon key — ไปที่ /setup เพื่อตั้งค่า');
  // กรณี deploy ใหม่ (Vercel/Cloudflare) แล้วลืมตั้ง env → พาไปหน้า Setup Wizard แทนจอขาว
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/setup')) {
    window.location.replace('/setup?reason=missing-backend-config');
  }
}


export const SUPABASE_RUNTIME_URL = SUPABASE_URL;
export const SUPABASE_RUNTIME_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_PUBLISHABLE_KEY || 'anon',
  {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY || 'anon'),
    },
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

// แก้ Edge Function non-2xx ให้โชว์ error จริงจาก body (แทน "Edge Function returned a non-2xx")
const _origInvoke = supabase.functions.invoke.bind(supabase.functions);
(supabase.functions as any).invoke = async (fn: string, opts?: any) => {
  const res: any = await _origInvoke(fn, opts);
  if (res?.error) {
    try {
      const ctx: any = res.error.context;
      let bodyText = "";
      if (ctx?.body) bodyText = typeof ctx.body === "string" ? ctx.body : await new Response(ctx.body).text().catch(()=> "");
      else if (ctx?.response) bodyText = await ctx.response.text().catch(()=> "");
      if (bodyText) {
        try { const j = JSON.parse(bodyText); if (j?.error) res.error.message = String(j.error); else if (j?.message) res.error.message = String(j.message); } catch { if (bodyText.length < 500) res.error.message = bodyText; }
      }
      // แปล weak password ให้เข้าใจง่าย
      if (/weak|pwned|compromised/i.test(res.error.message)) {
        res.error.message = "รหัสผ่านนี้ไม่ปลอดภัย (พบในฐานข้อมูลรหัสผ่านรั่วไหล) กรุณาใช้รหัสที่คาดเดายากขึ้น เช่น ผสมตัวใหญ่/เล็ก ตัวเลข สัญลักษณ์ อย่างน้อย 10 ตัว";
      }
    } catch {}
  }
  return res;
};
