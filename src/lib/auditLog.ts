import { supabase } from "@/integrations/supabase/client";
import { getRoleOverride } from "@/hooks/useUserRole";

export interface AuditLogInput {
  action: string;
  target_table?: string;
  target_id?: string;
  details?: Record<string, any>;
}

/**
 * บันทึกการกระทำของผู้ใช้ลง audit_logs (ไม่บล็อก)
 *
 * ถ้า admin กำลังสลับโหมดเป็นครู (impersonation) จะบันทึก:
 *  - user_role = role ที่ใช้งานอยู่ ("teacher")
 *  - details.actual_role = role จริงใน DB ("admin")
 *  - details.impersonating = true
 * เพื่อให้ตรวจสอบย้อนหลังได้ชัดเจนว่าทำในบริบทไหน
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    const userName = profile
      ? `${(profile as any).first_name || ""} ${(profile as any).last_name || ""}`.trim() || user.email
      : user.email;

    const actualRole = (roleRow as any)?.role || null;
    const override = getRoleOverride();
    const isImpersonating = actualRole === "admin" && override === "teacher";
    const effectiveRole = isImpersonating ? "teacher" : actualRole;

    const mergedDetails: Record<string, any> = {
      ...(input.details || {}),
      ...(isImpersonating
        ? { actual_role: actualRole, impersonating: true, mode: "teacher" }
        : { mode: actualRole }),
    };

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_name: userName || null,
      user_role: effectiveRole,
      action: input.action,
      target_table: input.target_table || null,
      target_id: input.target_id || null,
      details: mergedDetails,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    } as any);
  } catch (e) {
    console.warn("[logAudit] failed:", e);
  }
}
