import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DirectorSignature {
  id: string;
  name: string;
  position: string;
  signature_url: string; // data URL or storage URL
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  notes: string | null;
}

/** ดึงลายเซ็นที่ active ทั้งหมด เรียงตาม display_order */
export function useSignatures() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["director_signatures"],
    queryFn: async (): Promise<DirectorSignature[]> => {
      const { data } = await supabase
        .from("director_signatures")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      return (data || []) as any;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Realtime — เมื่อ admin เปลี่ยนลายเซ็น ทุกหน้าจอเด้งทันที
  useEffect(() => {
    const ch = supabase
      .channel(`director_signatures_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "director_signatures" }, () => {
        qc.invalidateQueries({ queryKey: ["director_signatures"] });
        qc.invalidateQueries({ queryKey: ["director_signatures_all"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return query;
}

/** ลายเซ็น default — ใช้ใน DocumentSignature เป็นค่าเริ่มต้น */
export function useDefaultSignature(): DirectorSignature | null {
  const { data } = useSignatures();
  return data?.find((s) => s.is_default) || data?.[0] || null;
}

/** ลายเซ็นตาม id (สำหรับ override) */
export function useSignatureById(id?: string | null): DirectorSignature | null {
  const { data } = useSignatures();
  if (!id) return null;
  return data?.find((s) => s.id === id) || null;
}

/** ดึงทุกลายเซ็น (รวม inactive) — สำหรับหน้าจัดการของ admin */
export function useAllSignatures() {
  return useQuery({
    queryKey: ["director_signatures_all"],
    queryFn: async (): Promise<DirectorSignature[]> => {
      const { data } = await supabase
        .from("director_signatures")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      return (data || []) as any;
    },
    staleTime: 30 * 1000,
  });
}
