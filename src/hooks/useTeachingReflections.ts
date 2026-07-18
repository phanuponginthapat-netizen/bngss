import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ReflectionStatus =
  | "draft" | "submitted" | "head_signed" | "academic_signed"
  | "deputy_signed" | "director_signed" | "returned";

export type SignerRole =
  | "teacher" | "head_subject" | "academic_head" | "deputy" | "director";

export interface TeachingReflection {
  id: string;
  teacher_id: string;
  subject_id: string | null;
  classroom_id: string | null;
  academic_period_id: string | null;
  subject_group: string | null;
  lesson_topic: string;
  lesson_date: string;
  period_no: number | null;
  hours_taught: number;
  learning_outcomes: string | null;
  students_total: number;
  students_pass: number;
  students_fail: number;
  pass_percent: number;
  score_knowledge: number;
  score_process: number;
  score_attitude: number;
  assessment_data: any;
  problems: string | null;
  suggestions: string | null;
  status: ReflectionStatus;
  current_step: number;
  created_at: string;
  updated_at: string;
}

export interface ReflectionAttachment {
  id: string;
  reflection_id: string;
  file_url: string;
  file_name: string | null;
  caption: string | null;
  display_order: number;
}

export interface ReflectionSignature {
  id: string;
  reflection_id: string;
  signer_role: SignerRole;
  signer_id: string;
  signer_name: string | null;
  signature_url: string | null;
  comment: string | null;
  signed_at: string;
}

const client: any = supabase;

export function useTeachingReflections(filters?: { periodId?: string | null; teacherId?: string | null; classroomId?: string | null; subjectId?: string | null; status?: ReflectionStatus | null }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["teaching_reflections", filters],
    queryFn: async () => {
      let query = client.from("teaching_reflections").select("*").order("lesson_date", { ascending: false });
      if (filters?.periodId) query = query.eq("academic_period_id", filters.periodId);
      if (filters?.teacherId) query = query.eq("teacher_id", filters.teacherId);
      if (filters?.classroomId) query = query.eq("classroom_id", filters.classroomId);
      if (filters?.subjectId) query = query.eq("subject_id", filters.subjectId);
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TeachingReflection[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const ch = client
      .channel(`reflections_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teaching_reflections" }, () => {
        qc.invalidateQueries({ queryKey: ["teaching_reflections"] });
      })
      .subscribe();
    return () => { client.removeChannel(ch); };
  }, [qc]);

  return q;
}

export function useReflectionDetail(id?: string | null) {
  return useQuery({
    queryKey: ["teaching_reflection", id],
    enabled: !!id,
    queryFn: async () => {
      const [r, a, s] = await Promise.all([
        client.from("teaching_reflections").select("*").eq("id", id).maybeSingle(),
        client.from("teaching_reflection_attachments").select("*").eq("reflection_id", id).order("display_order"),
        client.from("teaching_reflection_signatures").select("*").eq("reflection_id", id).order("signed_at"),
      ]);
      return {
        reflection: r.data as TeachingReflection | null,
        attachments: (a.data || []) as ReflectionAttachment[],
        signatures: (s.data || []) as ReflectionSignature[],
      };
    },
  });
}

export function useReflectionMutations() {
  const qc = useQueryClient();

  const upsert = useMutation({
    mutationFn: async (payload: Partial<TeachingReflection> & { id?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("ยังไม่ได้ล็อกอิน");
      const body: any = { ...payload };
      if (!body.id) body.teacher_id = body.teacher_id || uid;
      delete body.pass_percent; // generated column
      const { data, error } = await client
        .from("teaching_reflections")
        .upsert(body, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as TeachingReflection;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching_reflections"] });
      qc.invalidateQueries({ queryKey: ["teaching_reflection"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from("teaching_reflections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teaching_reflections"] }),
  });

  const sign = useMutation({
    mutationFn: async (input: { reflectionId: string; role: SignerRole; signatureUrl?: string; signerName?: string; comment?: string; nextStatus?: ReflectionStatus }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id!;
      const { error: e1 } = await client.from("teaching_reflection_signatures").upsert({
        reflection_id: input.reflectionId,
        signer_role: input.role,
        signer_id: uid,
        signer_name: input.signerName,
        signature_url: input.signatureUrl,
        comment: input.comment,
        signed_at: new Date().toISOString(),
      }, { onConflict: "reflection_id,signer_role" });
      if (e1) throw e1;
      if (input.nextStatus) {
        const stepMap: Record<ReflectionStatus, number> = {
          draft: 0, submitted: 1, head_signed: 2, academic_signed: 3, deputy_signed: 4, director_signed: 5, returned: 0,
        };
        const { error: e2 } = await client.from("teaching_reflections").update({
          status: input.nextStatus,
          current_step: stepMap[input.nextStatus],
        }).eq("id", input.reflectionId);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกลายเซ็นแล้ว");
      qc.invalidateQueries({ queryKey: ["teaching_reflections"] });
      qc.invalidateQueries({ queryKey: ["teaching_reflection"] });
    },
    onError: (e: any) => toast.error(e.message || "ลงนามไม่สำเร็จ"),
  });

  const returnForFix = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const { error } = await client.from("teaching_reflections").update({
        status: "returned", current_step: 0,
      }).eq("id", id);
      if (error) throw error;
      const { data: userRes } = await supabase.auth.getUser();
      await client.from("teaching_reflection_signatures").insert({
        reflection_id: id, signer_role: "academic_head", signer_id: userRes.user?.id,
        comment: `[ส่งกลับแก้ไข] ${comment}`,
      });
    },
    onSuccess: () => {
      toast.info("ส่งกลับให้ครูแก้ไขแล้ว");
      qc.invalidateQueries({ queryKey: ["teaching_reflections"] });
      qc.invalidateQueries({ queryKey: ["teaching_reflection"] });
    },
  });

  return { upsert, remove, sign, returnForFix };
}

export async function uploadReflectionFile(userId: string, reflectionId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${reflectionId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("teaching-reflections").upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  const { data } = await supabase.storage.from("teaching-reflections").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl || "";
}

export const STATUS_LABEL: Record<ReflectionStatus, string> = {
  draft: "ร่าง",
  submitted: "รอหัวหน้ากลุ่มสาระ",
  head_signed: "รอหัวหน้าวิชาการ",
  academic_signed: "รอรอง ผอ.",
  deputy_signed: "รอ ผอ.",
  director_signed: "อนุมัติสมบูรณ์",
  returned: "ส่งกลับแก้ไข",
};

export const STATUS_COLOR: Record<ReflectionStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-700",
  head_signed: "bg-indigo-100 text-indigo-700",
  academic_signed: "bg-purple-100 text-purple-700",
  deputy_signed: "bg-amber-100 text-amber-700",
  director_signed: "bg-emerald-100 text-emerald-700",
  returned: "bg-red-100 text-red-700",
};
