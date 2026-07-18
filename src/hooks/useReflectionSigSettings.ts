import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SignerRole } from "@/hooks/useTeachingReflections";

export type RenderMode = "image" | "blank" | "name_only";
export type AlignMode = "left" | "center" | "right";
export type SizePreset = "sm" | "md" | "lg" | "custom";

export interface ReflectionSigSetting {
  id: string;
  role: SignerRole;
  signature_id: string | null;
  render_mode: RenderMode;
  align: AlignMode;
  offset_x_mm: number;
  offset_y_mm: number;
  size_preset: SizePreset;
  size_px: number;
  show_comment_line: boolean;
  override_name: string | null;
  override_position: string | null;
}

const client: any = supabase;

export const SIZE_PRESET_PX: Record<Exclude<SizePreset, "custom">, number> = {
  sm: 28, md: 40, lg: 60,
};

export function resolveSizePx(s: Pick<ReflectionSigSetting, "size_preset" | "size_px">): number {
  if (s.size_preset === "custom") return Math.max(16, Math.min(200, s.size_px || 40));
  return SIZE_PRESET_PX[s.size_preset];
}

export function useReflectionSigSettings() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["reflection_sig_settings"],
    queryFn: async (): Promise<Record<SignerRole, ReflectionSigSetting>> => {
      const { data, error } = await client
        .from("teaching_reflection_signature_settings")
        .select("*");
      if (error) throw error;
      const out = {} as Record<SignerRole, ReflectionSigSetting>;
      (data || []).forEach((r: ReflectionSigSetting) => { out[r.role] = r; });
      return out;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const ch = client
      .channel(`refl_sig_settings_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teaching_reflection_signature_settings" }, () => {
        qc.invalidateQueries({ queryKey: ["reflection_sig_settings"] });
      })
      .subscribe();
    return () => { client.removeChannel(ch); };
  }, [qc]);

  return q;
}

export function useUpdateReflectionSigSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ReflectionSigSetting> & { role: SignerRole }) => {
      const { role, ...rest } = input;
      const { error } = await client
        .from("teaching_reflection_signature_settings")
        .upsert({ role, ...rest }, { onConflict: "role" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าลายเซ็นแล้ว");
      qc.invalidateQueries({ queryKey: ["reflection_sig_settings"] });
    },
    onError: (e: any) => toast.error(e.message || "บันทึกไม่สำเร็จ"),
  });
}
