// Spider Hub Live Ops — fetch live counts for each module's "pending" state.
// Used by SpiderHubPage to overlay a live badge on each module card.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ModuleLiveMetric {
  count: number;
  label: string;
  tone: "destructive" | "warning" | "info" | "success";
}

type Counts = Record<string, ModuleLiveMetric | undefined>;

export function useSpiderHubMetrics() {
  return useQuery<Counts>({
    queryKey: ["spider_hub_metrics"],
    staleTime: 60_000,
    refetchInterval: 90_000,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [
        attendanceMissing, leavesPending, behaviorWeek, damagePending,
        eformsActive, newsRecent, hwOverdue,
        scheduleToday,
      ] = await Promise.all([
        supabase.from("attendance").select("id", { count: "exact", head: true })
          .eq("attendance_date", today).eq("status", "absent"),
        supabase.from("student_leaves").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("behavior_records").select("id", { count: "exact", head: true })
          .gte("record_date", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]),
        supabase.from("asset_damage_reports").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("eforms").select("id", { count: "exact", head: true })
          .neq("status", "completed"),
        supabase.from("news_posts").select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from("task_assignments").select("id", { count: "exact", head: true })
          .eq("task_type", "homework").eq("status", "pending").lte("due_date", today),
        supabase.from("schedules").select("id", { count: "exact", head: true })
          .eq("day_of_week", new Date().getDay()),
      ]);

      const out: Counts = {};
      const set = (k: string, n: number | null, label: string, tone: ModuleLiveMetric["tone"]) => {
        if ((n ?? 0) > 0) out[k] = { count: n!, label, tone };
      };

      set("attendance", attendanceMissing.count, "ขาดวันนี้", "destructive");
      set("leave", leavesPending.count, "รออนุมัติ", "warning");
      set("behavior", behaviorWeek.count, "สัปดาห์นี้", "info");
      set("assets", damagePending.count, "รอซ่อม", "warning");
      set("eform", eformsActive.count, "ดำเนินการ", "info");
      set("news", newsRecent.count, "ใหม่สัปดาห์นี้", "success");
      set("academic", hwOverdue.count, "การบ้านค้าง", "warning");
      set("schedule", scheduleToday.count, "คาบวันนี้", "info");

      return out;
    },
  });
}
