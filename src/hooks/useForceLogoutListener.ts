import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * นักเรียนทุกคนที่ login อยู่ subscribe ช่อง broadcast กลาง
 * ครูสามารถสั่ง force-logout ได้แม้ว่านักเรียนจะไม่ได้เปิดหน้า Agent
 *
 * payload:
 *   { classroom?: string | "*", role?: "student" | "*", reason?: string }
 */
export function useForceLogoutListener(params: {
  userId: string | null | undefined;
  role: string | null | undefined;
  classroom?: string | null;
}) {
  const { userId, role, classroom } = params;

  useEffect(() => {
    if (!userId || !role) return;
    // apply mainly to students; teachers/admins ignore
    if (role !== "student") return;

    const ch = supabase.channel("classroom-broadcast", {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "force-logout" }, async ({ payload }) => {
      const targetClass = payload?.classroom ?? "*";
      const targetRole = payload?.role ?? "student";
      if (targetRole !== "*" && targetRole !== role) return;
      if (targetClass !== "*" && classroom && targetClass !== classroom) return;

      toast(payload?.reason || "ครูสั่งออกจากระบบ", { duration: 3000 });
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        window.location.href = "/login";
      }, 400);
    });

    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, role, classroom]);
}
