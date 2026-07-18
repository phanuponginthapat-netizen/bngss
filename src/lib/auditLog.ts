import { supabase } from "@/integrations/supabase/client";

export interface AuditLogInput {
  action: string;
  target_table?: string;
  target_id?: string;
  details?: Record<string, any>;
}

/**
 * บันทึกการกระทำของผู้ใช้ลง audit_logs
 * เรียกแบบไม่บล็อก — ถ้าผิดจะ log warn เฉยๆ
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // หา profile + role
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    const userName = profile
      ? `${(profile as any).first_name || ""} ${(profile as any).last_name || ""}`.trim() || user.email
      : user.email;

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_name: userName || null,
      user_role: (roleRow as any)?.role || null,
      action: input.action,
      target_table: input.target_table || null,
      target_id: input.target_id || null,
      details: input.details || {},
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    } as any);
  } catch (e) {
    console.warn("[logAudit] failed:", e);
  }
}