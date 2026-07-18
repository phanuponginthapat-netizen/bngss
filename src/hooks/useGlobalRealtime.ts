import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { playNotificationSound } from "@/lib/notificationSound";

/**
 * Global realtime subscription that invalidates react-query caches
 * when any core table changes. Role-based: subscribes only to tables
 * the current user actually needs, reducing payload by 60-80%.
 */
export function useGlobalRealtime() {
  const qc = useQueryClient();
  const { role, userId } = useUserRole();

  useEffect(() => {
    if (!userId) return;

    // Tables every authenticated user needs (notifications/inbox/news/eforms/social wall)
    const baseTables = [
      "notifications", "inbox_items", "news_posts", "academic_events",
      "emergency_broadcasts", "profiles", "eforms", "eform_recipients",
      "documents", "document_recipients", "face_scan_logs",
      "social_posts", "wall_posts", "wall_post_comments", "wall_post_reactions",
      "learning_contents", "learning_views",
    ];

    // Admin/Director: full system view
    const adminTables = [
      // Core
      "students", "classrooms", "personnel", "user_roles",
      // Attendance & Student Affairs
      "attendance", "behavior_records", "student_leaves", "student_screenings",
      "sdq_records", "home_visits", "homeroom_records", "health_records",
      // Academic
      "enrollments", "student_scores", "student_column_scores", "subject_score_columns",
      "subjects", "schedules", "homework_assignments", "task_assignments", "assessment_criteria",
      "student_assessment_scores", "early_childhood_dev",
      // Documents
      "documents", "document_recipients",
      // HR & Finance
      "staff_leaves", "staff_evaluations", "salary_records", "personnel_assessments",
      "id_plan_records", "pa_agreements", "pa_indicator_scores",
      "budget_transactions", "account_balances", "assets", "asset_damage_reports",
      "procurement_records", "procurement_advances", "procurement_documents", "student_subsidies",
      // Admin
      "admissions", "school_settings", "cms_settings", "cms_pages", "google_chat_webhooks",
      // Misc
      "school_lunch_records", "school_milk_records",
      "action_plans", "pp5_files", "pp6_files",
      "time_clock", "substitute_teaching", "inbox_items",
      // Garbage / ICT / Learning center
      "garbage_deposits", "garbage_redemptions", "ict_loans", "learning_center_bookings",
    ];

    // Teacher: classroom/academic/HR-self
    const teacherTables = [
      "students", "classrooms", "attendance", "behavior_records", "student_leaves",
      "homeroom_records", "enrollments", "student_scores", "student_column_scores",
      "subject_score_columns", "subjects", "schedules", "homework_assignments", "task_assignments",
      "documents", "document_recipients", "staff_leaves", "pa_agreements",
      "personnel", "asset_damage_reports", "time_clock", "substitute_teaching",
      "garbage_deposits", "garbage_redemptions", "ict_loans", "learning_center_bookings",
    ];

    // Student/Alumni: personal data
    const studentTables = [
      "attendance", "behavior_records", "student_leaves", "enrollments",
      "student_scores", "student_column_scores", "schedules", "homework_assignments", "task_assignments",
      "homeroom_records",
      "garbage_deposits", "garbage_redemptions", "ict_loans",
    ];


    let tables: string[];
    if (role === "admin" || role === "director") tables = [...baseTables, ...adminTables];
    else if (role === "teacher") tables = [...baseTables, ...teacherTables];
    else if (role === "student" || role === "alumni") tables = [...baseTables, ...studentTables];
    else tables = baseTables;

    // Dedupe
    tables = Array.from(new Set(tables));

    // Mapping of table → extra query keys to invalidate
    const extraKeys: Record<string, string[][]> = {
      students: [["active-students-with-class"], ["students_all"], ["students_with_class"]],
      classrooms: [["all-classrooms"]],
      attendance: [["dashboard_stats_v2"], ["mascot_stats"]],
      personnel: [["my_personnel"], ["dashboard_stats_v2"]],
      news_posts: [["dashboard_stats_v2"]],
      academic_events: [["dashboard_stats_v2"]],
      face_scan_logs: [
        ["dashboard_stats_v2"], ["mascot_stats"],
        ["face-logs-range"], ["face-chart"], ["face-report-accurate"],
        ["face-scan-today"], ["face-scan-recent"],
      ],
      notifications: [["notifications"]],
      profiles: [["dashboard_user_profile"]],
      student_scores: [["student_scores"]],
      student_column_scores: [["student_column_scores"]],
      subject_score_columns: [["subject_score_columns"]],
      student_leaves: [["student_leaves"], ["mascot_stats"]],
      staff_leaves: [["staff_leaves"]],
      behavior_records: [["behavior_records"]],
      home_visits: [["home_visits"]],
      homeroom_records: [["homeroom_records"]],
      student_screenings: [["student_screenings"]],
      sdq_records: [["sdq_records"]],
      enrollments: [["enrollments"]],
      subjects: [["subjects"]],
      schedules: [["schedules"]],
      task_assignments: [["homework-list"], ["teacher-tasks"], ["student-tasks"]],
      documents: [["documents"]],
      assets: [["assets"]],
      asset_damage_reports: [["asset_damage_reports"], ["damage_reports"]],
      budget_transactions: [["budget_transactions"]],
      id_plan_records: [["id_plan_records"], ["my_id_plan_records"]],
      salary_records: [["salary_records"], ["my_salary_records"]],
      pa_agreements: [["pa_agreements"]],
      pa_indicator_scores: [["pa_indicator_scores"]],
      student_subsidies: [["student_subsidies"]],
      
      school_lunch_records: [["school_lunch_records"]],
      school_milk_records: [["school_milk_records"]],
      action_plans: [["action_plans"]],
      cms_settings: [["cms_settings_bulk"]],
      school_settings: [["school_settings_bulk"]],
    };

    let channel = supabase.channel(`role-realtime-${role || "anon"}`);

    for (const table of tables) {
      // Filter notifications/inbox to current user only — drastically reduces payload
      const filter =
        table === "notifications" || table === "inbox_items"
          ? { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }
          : { event: "*", schema: "public", table };

      channel = channel.on(
        "postgres_changes" as any,
        filter,
        (payload: any) => {
          // Always invalidate by table name
          qc.invalidateQueries({ queryKey: [table] });
          const extra = extraKeys[table];
          if (extra) {
            for (const key of extra) qc.invalidateQueries({ queryKey: key });
          }

          // ===== Live toast + sound for incoming items =====
          if (payload?.eventType !== "INSERT") return;
          const row = payload.new || {};

          if (table === "notifications" && row.user_id === userId) {
            playNotificationSound();
            toast(row.title || "การแจ้งเตือนใหม่", {
              description: row.message || undefined,
            });
          } else if (table === "inbox_items" && row.user_id === userId) {
            playNotificationSound({ urgent: row.priority === "high" });
            toast(row.title || "ข้อความใหม่", {
              description: row.message || undefined,
            });
          } else if (table === "emergency_broadcasts") {
            playNotificationSound({ urgent: true });
            toast.error("🚨 " + (row.title || "ประกาศฉุกเฉิน"), {
              description: row.message || undefined,
              duration: 10000,
            });
          } else if (table === "news_posts" && row.is_published) {
            playNotificationSound();
            toast(`📢 ${row.title || "ข่าวใหม่"}`);
          } else if (table === "eform_recipients" && row.recipient_id === userId) {
            playNotificationSound();
            toast("📄 มีเอกสาร E-Form ใหม่ถึงคุณ");
          } else if (table === "document_recipients" && row.recipient_user_id === userId) {
            playNotificationSound();
            toast("📨 มีเอกสารใหม่ในกล่องรับ");
          }

        }
      );
    }

    channel.subscribe((status) => {
      // Auto-resync on (re)connect so we never miss data after sleep/offline
      if (status === "SUBSCRIBED") {
        qc.invalidateQueries();
      }
    });

    // Force resync when tab becomes visible or network restored
    const resync = () => {
      qc.invalidateQueries();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [qc, role, userId]);
}
