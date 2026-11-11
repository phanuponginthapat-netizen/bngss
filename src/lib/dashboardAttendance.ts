import { supabase } from "@/integrations/supabase/client";

export interface DashboardAttendanceDay {
  date: string; total: number; present: number; late: number; absent: number; leave: number; unrecorded: number; evidence: boolean;
}
export function attendanceRate(day?: DashboardAttendanceDay): number | null {
  if (!day?.evidence || day.total <= 0) return null;
  return Math.round((day.present + day.late) / day.total * 1000) / 10;
}
export async function loadDashboardAttendance(today: string) {
  const { data, error } = await supabase.functions.invoke("public-school-attendance", { body: { mode: "month", month: today.slice(0, 7) } });
  if (error || data?.error || !Array.isArray(data?.daily)) throw new Error("โหลดสถิติการมาโรงเรียนไม่สำเร็จ");
  const daily = data.daily as DashboardAttendanceDay[];
  const day = daily.find(row => row.date === today);
  if (!day) throw new Error("ข้อมูลการมาโรงเรียนไม่ตรงกับวันที่รายงาน");
  return { day, daily, rate: attendanceRate(day), rosterTotal: Number(data.rosterTotal) };
}