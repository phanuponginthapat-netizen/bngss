import { supabase } from "@/integrations/supabase/client";

/**
 * ตัดสินใจว่าหลัง login เสร็จควรพาไปหน้าไหน
 * - ถ้าเครื่องเป็น Kiosk Student mode + user เป็น student → /dashboard/n (Agent page)
 * - อื่น ๆ → ค่า default (โดยปกติ /dashboard)
 */
export async function resolvePostLoginRedirect(defaultTarget: string): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return defaultTarget;

    const [{ data: role }, { data: cfg }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("school_settings").select("setting_value").eq("setting_key", "kiosk_config").maybeSingle(),
    ]);

    const userRole = (role as any)?.role;
    let mode: string | undefined;
    let v: any = (cfg as any)?.setting_value;
    if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } }
    mode = v?.mode;

    if (userRole === "student" && mode === "student") {
      return "/dashboard/n";
    }
  } catch { /* ignore, fall back to default */ }
  return defaultTarget;
}
