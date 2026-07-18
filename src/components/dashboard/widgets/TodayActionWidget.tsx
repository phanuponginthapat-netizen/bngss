import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  Inbox as InboxIcon,
  ListTodo,
  Sparkles,
  UserMinus,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: string;
  label: string;
  count: number;
  icon: typeof ListTodo;
  to: string;
  tone: "warning" | "info" | "destructive" | "primary" | "success";
  hint?: string;
}

const TONE: Record<ActionItem["tone"], string> = {
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-info/10 text-info border-info/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
};

/**
 * "ต้องทำวันนี้" — Unified actionable inbox for the current user.
 * Role-aware: shows pending tasks, leave approvals, e-form approvals, damage reports, overdue homework reviews.
 */
export default function TodayActionWidget() {
  const navigate = useNavigate();
  const { userId, role } = useUserRole();
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const isApprover = role === "admin" || role === "director";

  const { data, isLoading } = useQuery({
    queryKey: ["today_actions", userId, role],
    enabled: !!userId,
    staleTime: 60_000,
    refetchInterval: 90_000,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const [
        myTasks,
        eformInbox,
        pendingStuLeaves,
        pendingStaffLeaves,
        pendingDamage,
        unreadInbox,
        overdueHw,
      ] = await Promise.all([
        // Tasks assigned to me
        supabase
          .from("task_assignments")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to_user_id", userId!)
          .eq("status", "pending"),
        // E-Form in my inbox awaiting signature
        supabase
          .from("eform_recipients")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId!)
          .eq("status", "pending"),
        // Pending student leave approvals (approver only)
        isApprover
          ? supabase
              .from("student_leaves")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
          : { count: 0 },
        // Pending staff leave approvals
        isApprover
          ? supabase
              .from("staff_leaves")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
          : { count: 0 },
        // Pending damage reports
        isApprover
          ? supabase
              .from("asset_damage_reports")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
          : { count: 0 },
        // Unread inbox items
        supabase
          .from("inbox_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .eq("is_read", false),
        // Overdue homework I assigned (teacher)
        role === "teacher"
          ? supabase
              .from("task_assignments")
              .select("id", { count: "exact", head: true })
              .eq("assigned_by", userId!)
              .eq("task_type", "homework")
              .eq("status", "pending")
              .lte("due_date", today)
          : { count: 0 },
      ]);

      return {
        myTasks: myTasks.count ?? 0,
        eformInbox: eformInbox.count ?? 0,
        pendingStuLeaves: (pendingStuLeaves as any).count ?? 0,
        pendingStaffLeaves: (pendingStaffLeaves as any).count ?? 0,
        pendingDamage: (pendingDamage as any).count ?? 0,
        unreadInbox: unreadInbox.count ?? 0,
        overdueHw: (overdueHw as any).count ?? 0,
      };
    },
  });

  const items = useMemo<ActionItem[]>(() => {
    if (!data) return [];
    const list: ActionItem[] = [];

    if (data.myTasks > 0) {
      list.push({
        id: "tasks",
        label: L("งานที่ต้องทำ", "My tasks"),
        count: data.myTasks,
        icon: ListTodo,
        to: "/dashboard/inbox",
        tone: "warning",
        hint: L("งานจากผู้บริหาร/ผู้บังคับบัญชา", "From leadership"),
      });
    }
    if (data.eformInbox > 0) {
      list.push({
        id: "eform",
        label: L("เอกสารรอลงนาม", "E-Forms to sign"),
        count: data.eformInbox,
        icon: FileSignature,
        to: "/dashboard/eform/inbox",
        tone: "primary",
      });
    }
    if (data.unreadInbox > 0) {
      list.push({
        id: "inbox",
        label: L("ข้อความใหม่", "Unread messages"),
        count: data.unreadInbox,
        icon: InboxIcon,
        to: "/dashboard/inbox",
        tone: "info",
      });
    }
    if (data.overdueHw > 0) {
      list.push({
        id: "hw",
        label: L("การบ้านเลยกำหนด", "Overdue homework"),
        count: data.overdueHw,
        icon: ClipboardList,
        to: "/dashboard/homework",
        tone: "destructive",
        hint: L("ต้องตรวจ/ติดตาม", "Needs review"),
      });
    }
    if (data.pendingStuLeaves > 0) {
      list.push({
        id: "stu_leave",
        label: L("ใบลานักเรียนรออนุมัติ", "Student leaves pending"),
        count: data.pendingStuLeaves,
        icon: UserMinus,
        to: "/dashboard/student/leave",
        tone: "info",
      });
    }
    if (data.pendingStaffLeaves > 0) {
      list.push({
        id: "staff_leave",
        label: L("ใบลาบุคลากรรออนุมัติ", "Staff leaves pending"),
        count: data.pendingStaffLeaves,
        icon: CalendarClock,
        to: "/dashboard/hr/leave",
        tone: "info",
      });
    }
    if (data.pendingDamage > 0) {
      list.push({
        id: "damage",
        label: L("แจ้งซ่อมรอดำเนินการ", "Repairs pending"),
        count: data.pendingDamage,
        icon: Wrench,
        to: "/dashboard/finance/assets",
        tone: "warning",
      });
    }
    return list;
  }, [data, lang]);

  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <Card className="border border-border/50 shadow-elevated rounded-2xl h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            {L("ต้องทำวันนี้", "Today's Actions")}
          </CardTitle>
          {total > 0 ? (
            <Badge className="bg-destructive/10 text-destructive border-0 text-[11px]">
              {total} {L("รายการ", "items")}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {L("เคลียร์งานวันนี้แล้ว 🎉", "All caught up 🎉")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {L("ไม่มีงานค้างที่ต้องทำตอนนี้", "Nothing pending right now")}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  onClick={() => navigate(it.to)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all group hover:shadow-sm",
                    TONE[it.tone]
                  )}
                >
                  <div className="w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{it.label}</p>
                    {it.hint && (
                      <p className="text-[11px] text-muted-foreground truncate">{it.hint}</p>
                    )}
                  </div>
                  <span className="text-base font-bold tabular-nums">{it.count}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
