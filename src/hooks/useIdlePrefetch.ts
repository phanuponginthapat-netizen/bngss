import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

type IdleHandle = number;

function onIdle(cb: () => void, timeout = 4000): IdleHandle {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    return w.requestIdleCallback(cb, { timeout });
  }
  return window.setTimeout(cb, timeout);
}

function cancelIdle(handle: IdleHandle) {
  const w = window as unknown as { cancelIdleCallback?: (h: number) => void };
  if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
}

/**
 * useIdlePrefetch — โหลดข้อมูลที่ใช้บ่อยไว้ล่วงหน้าตอนเบราว์เซอร์ว่าง
 * เพื่อให้เปิดหน้าถัดไป (ตารางสอน / รายชื่อนักเรียน / สรุปรายวัน) ได้ทันที
 * - ใช้ prefetchQuery จึงไม่ยิงซ้ำถ้ามี cache สดอยู่แล้ว
 * - ข้ามเมื่อผู้ใช้อยู่บนเน็ตช้า / ประหยัดข้อมูล
 */
export function useIdlePrefetch() {
  const qc = useQueryClient();
  const { role, userId, loading } = useUserRole();

  useEffect(() => {
    if (loading || !userId || !role) return;
    if (typeof window === "undefined") return;

    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /2g/.test(conn.effectiveType)) return;

    const staffRoles = ["admin", "director", "teacher", "observer"];
    const isStaff = staffRoles.includes(role);

    const handle = onIdle(() => {
      // ห้องเรียน — ใช้แทบทุกหน้าของบุคลากร
      if (isStaff) {
        void qc.prefetchQuery({
          queryKey: ["classrooms"],
          queryFn: async () => {
            const { data } = await supabase
              .from("classrooms")
              .select("id, name, grade_level, room_number, homeroom_teacher_id")
              .order("grade_level");
            return data || [];
          },
          staleTime: 10 * 60_000,
        });

        void qc.prefetchQuery({
          queryKey: ["students_with_class"],
          queryFn: async () => {
            const { data } = await supabase
              .from("students")
              .select("*, classrooms!students_classroom_id_fkey(*)")
              .eq("status", "active")
              .order("student_code");
            return data || [];
          },
          staleTime: 10 * 60_000,
        });
      }

      // ตารางสอน/ตารางเรียนของวันนี้ — ใช้ทุกบทบาท
      void qc.prefetchQuery({
        queryKey: ["schedules", "prefetch"],
        queryFn: async () => {
          const { data } = await supabase
            .from("schedules")
            .select("id, day_of_week, period, subject_id, classroom_id, teacher_id, start_time, end_time")
            .limit(1000);
          return data || [];
        },
        staleTime: 10 * 60_000,
      });
    }, 5000);

    return () => cancelIdle(handle);
  }, [qc, role, userId, loading]);
}
