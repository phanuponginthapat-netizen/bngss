// Spider-web notifier: given a student event, fan out to everyone who cares.
// Recipients: the student themselves (if linked), their parents, and the homeroom teacher(s).
// Never throws — failures are logged.

import { supabase } from "@/integrations/supabase/client";
import { notify, type NotifySeverity } from "@/lib/notify";

export interface StudentEventOpts {
  student_id: string;
  title: string;
  body?: string;
  type: string;
  severity?: NotifySeverity;
  reference_id?: string | null;
  reference_type?: string | null;
  url?: string | null;
  audience?: {
    student?: boolean;
    parents?: boolean;
    homeroom?: boolean;
  };
}

/**
 * Resolve recipients for a student event and fire notify() once.
 * - Student: via students.auth_user_id
 * - Parents: profiles.student_code == students.student_code
 * - Homeroom teacher(s): classrooms.homeroom_teacher_id / homeroom_teacher_2_id → personnel.user_id
 */
export async function notifyStudentEvent(opts: StudentEventOpts): Promise<void> {
  try {
    const aud = {
      student: opts.audience?.student ?? true,
      parents: opts.audience?.parents ?? true,
      homeroom: opts.audience?.homeroom ?? true,
    };

    const { data: st } = await supabase
      .from("students")
      .select("id, student_code, auth_user_id, classroom_id")
      .eq("id", opts.student_id)
      .maybeSingle();
    if (!st) return;

    const userIds = new Set<string>();

    if (aud.student && (st as any).auth_user_id) userIds.add((st as any).auth_user_id);

    if (aud.parents && (st as any).student_code) {
      const { data: parents } = await supabase
        .from("profiles")
        .select("id")
        .eq("student_code", (st as any).student_code);
      (parents ?? []).forEach((p: any) => p.id && userIds.add(p.id));
    }

    if (aud.homeroom && (st as any).classroom_id) {
      const { data: cls } = await supabase
        .from("classrooms")
        .select("homeroom_teacher_id, homeroom_teacher_2_id")
        .eq("id", (st as any).classroom_id)
        .maybeSingle();
      const personnelIds = [
        (cls as any)?.homeroom_teacher_id,
        (cls as any)?.homeroom_teacher_2_id,
      ].filter(Boolean);
      if (personnelIds.length) {
        const { data: people } = await supabase
          .from("personnel")
          .select("user_id")
          .in("id", personnelIds);
        (people ?? []).forEach((p: any) => p.user_id && userIds.add(p.user_id));
      }
    }

    if (userIds.size === 0) return;

    await notify({
      user_ids: Array.from(userIds),
      title: opts.title,
      body: opts.body,
      type: opts.type,
      severity: opts.severity,
      reference_id: opts.reference_id,
      reference_type: opts.reference_type,
      url: opts.url,
    });
  } catch (e) {
     
    console.warn("[notifyStudentEvent] failed", e);
  }
}
