import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { routeForNotification } from "@/lib/notificationRoute";
import { showLiveNotification } from "@/lib/liveNotification";


/**
 * Global realtime subscription that invalidates react-query caches
 * when any core table changes. Role-based: subscribes only to tables
 * the current user actually needs, reducing payload by 60-80%.
 */
export function useGlobalRealtime() {
  const qc = useQueryClient();
  const { role, userId } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for both userId and role to resolve before subscribing.
    // Subscribing as "anon" then re-subscribing as the real role caused a redundant
    // mass invalidateQueries() on the first connect.
    if (!userId || !role) return;


    // Tables every authenticated user needs (notifications/inbox/news/eforms/social wall)
    const baseTables = [
      "notifications", "inbox_items", "news_posts", "academic_events",
      "emergency_broadcasts", "profiles", "eforms", "eform_recipients",
      "documents", "document_recipients", "face_scan_logs",
      "social_posts", "wall_posts", "wall_post_comments", "wall_post_reactions",
    ];

    // Admin/Director: full system view
    const adminTables = [
      // Core
      "students", "classrooms", "personnel", "user_roles",
      // Attendance & Student Affairs
      "attendance", "behavior_records", "student_leaves", "student_screenings",
      "sdq_records", "home_visits", "home_visit_summaries", "homeroom_records",
      "health_records", "health_measurements", "vaccine_records",
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
      "procurement_records", "student_subsidies",
      // Admin
      "admissions", "school_settings", "cms_settings", "cms_pages", "google_chat_webhooks",
      // Misc
      "school_lunch_records", "school_milk_records",
      "action_plans", "pp5_files", "pp6_files",
      "time_clock", "substitute_teaching", "inbox_items",
      // Teaching Excellence
      "lesson_plans", "teaching_logbook",
      // Garbage / ICT / Learning center
      "garbage_deposits", "garbage_redemptions", "ict_loans", "learning_center_bookings",
    ];

    // Teacher: classroom/academic/HR-self
    const teacherTables = [
      "students", "classrooms", "attendance", "behavior_records", "student_leaves",
      "sdq_records", "home_visits", "home_visit_summaries", "health_measurements", "vaccine_records",
      "homeroom_records", "enrollments", "student_scores", "student_column_scores",
      "subject_score_columns", "subjects", "schedules", "homework_assignments", "task_assignments",
      "documents", "document_recipients", "staff_leaves", "pa_agreements",
      "personnel", "asset_damage_reports", "time_clock", "substitute_teaching",
      "lesson_plans", "teaching_logbook",
      "garbage_deposits", "garbage_redemptions", "ict_loans", "learning_center_bookings",
    ];

    // Student/Alumni: personal data
    const studentTables = [
      "attendance", "behavior_records", "student_leaves", "enrollments",
      "student_scores", "student_column_scores", "schedules", "homework_assignments",
      "homework_submissions", "task_assignments",
      "homeroom_records",
      "garbage_deposits", "garbage_redemptions", "ict_loans",
    ];

    // Parent: ดูข้อมูลลูก (เช็คชื่อ/พฤติกรรม/ลา/คะแนน/การบ้าน)
    const parentTables = [
      "attendance", "behavior_records", "student_leaves",
      "student_scores", "student_column_scores", "homework_assignments", "homework_submissions",
      "schedules",
    ];


    let tables: string[];
    if (role === "admin" || role === "director") tables = [...baseTables, ...adminTables];
    else if (role === "teacher") tables = [...baseTables, ...teacherTables];
    else if (role === "student" || role === "alumni") tables = [...baseTables, ...studentTables];
    else if (role === "parent") tables = [...baseTables, ...parentTables];
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
      face_scan_logs: [["dashboard_stats_v2"], ["mascot_stats"]],
      notifications: [["notifications"]],
      profiles: [["dashboard_user_profile"]],
      student_scores: [["student_scores"]],
      student_column_scores: [["student_column_scores"]],
      subject_score_columns: [["subject_score_columns"]],
      student_leaves: [["student_leaves"], ["mascot_stats"]],
      staff_leaves: [["staff_leaves"]],
      behavior_records: [["behavior_records"]],
      home_visits: [["home_visits"]],
      home_visit_summaries: [["home_visit_summaries"]],
      vaccine_records: [["vaccine_records"]],
      health_measurements: [["health_measurements"], ["health_trend"]],
      homeroom_records: [["homeroom_records"]],
      student_screenings: [["student_screenings"]],
      sdq_records: [["sdq_records"]],
      enrollments: [["enrollments"]],
      subjects: [["subjects"]],
      schedules: [["schedules"]],
      task_assignments: [["homework-list"], ["teacher-tasks"], ["student-tasks"]],
      homework_assignments: [["homework-list"], ["homework_assignments"], ["subject_score_columns"], ["student_column_scores"]],
      homework_submissions: [["hw-submissions"], ["homework_submissions"], ["student_column_scores"]],
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

    let channel = supabase.channel(`role-rt-${role}-${userId}`);

    // ── Coalesce invalidations ── ป้องกัน refetch พายุ เมื่อมี insert หลาย row ติดกัน
    // (เช่น import DMC 500 คน หรือ face scan รัวๆ ตอนเข้าแถว 8:00)
    // รวม invalidate ต่อ queryKey เป็นรอบเดียวใน 400ms
    const pendingInvalidations = new Map<string, string[]>();
    let invalidationTimer: number | null = null;
    const scheduleInvalidate = (keys: string[][]) => {
      for (const key of keys) {
        const sig = JSON.stringify(key);
        if (!pendingInvalidations.has(sig)) pendingInvalidations.set(sig, key);
      }
      if (invalidationTimer !== null) return;
      invalidationTimer = window.setTimeout(() => {
        invalidationTimer = null;
        const batch = Array.from(pendingInvalidations.values());
        pendingInvalidations.clear();
        for (const key of batch) qc.invalidateQueries({ queryKey: key });
      }, 400);
    };

    for (const table of tables) {
      const filter =
        table === "notifications" || table === "inbox_items"
          ? { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }
          : { event: "*", schema: "public", table };

      channel = channel.on(
        "postgres_changes" as any,
        filter,
        (payload: any) => {
          const keys: string[][] = [[table]];
          const extra = extraKeys[table];
          if (extra) keys.push(...extra);
          scheduleInvalidate(keys);

          // ===== Live toast + sound for incoming items =====
          if (payload?.eventType !== "INSERT") return;
          const row = payload.new || {};

          const notify = (o: {
            title: string;
            body?: string;
            route?: string | null;
            urgent?: boolean;
            icon?: string;
          }) =>
            showLiveNotification({
              title: o.title,
              body: o.body,
              route: o.route,
              urgent: o.urgent,
              icon: o.icon,
              tag: `${table}-${row.id ?? ""}`,
              onNavigate: (r) => navigate(r),
            });

          if (table === "notifications" && row.user_id === userId) {
            notify({
              title: row.title || "การแจ้งเตือนใหม่",
              body: row.message || undefined,
              route: routeForNotification(row, role) || "/dashboard/inbox",
              icon: "🔔",
            });
          } else if (table === "inbox_items" && row.user_id === userId) {
            notify({
              title: row.title || "ข้อความใหม่",
              body: row.message || undefined,
              urgent: row.priority === "high",
              route: routeForNotification(row, role) || "/dashboard/inbox",
              icon: "✉️",
            });
          } else if (table === "emergency_broadcasts") {
            notify({
              title: "🚨 " + (row.title || "ประกาศฉุกเฉิน"),
              body: row.message || undefined,
              urgent: true,
              route: "/dashboard/emergency",
              icon: "🚨",
            });
          } else if (table === "news_posts" && row.is_published) {
            notify({
              title: row.title || "ข่าวใหม่",
              route: row.id ? `/dashboard/news/${row.id}` : "/dashboard/admin/news",
              icon: "📢",
            });
          } else if (table === "eform_recipients" && row.recipient_id === userId) {
            notify({
              title: "มีเอกสาร E-Form ใหม่ถึงคุณ",
              route: row.eform_id ? `/dashboard/inbox?tab=eform&doc=${row.eform_id}` : "/dashboard/inbox?tab=eform",
              icon: "📄",
            });
          } else if (table === "document_recipients" && row.recipient_user_id === userId) {
            notify({
              title: "มีเอกสารใหม่ในกล่องรับ",
              route: row.document_id ? `/dashboard/inbox?tab=documents&doc=${row.document_id}` : "/dashboard/inbox?tab=documents",
              icon: "📨",
            });
          } else if (table === "wall_post_comments") {
            notify({
              title: "มีความคิดเห็นใหม่",
              body: row.content || undefined,
              route: row.post_id ? `/dashboard/wall#post-${row.post_id}` : "/dashboard/wall",
              icon: "💬",
            });
          } else if (table === "wall_post_reactions") {
            notify({
              title: "มีคนกดถูกใจโพสต์ของคุณ",
              route: row.post_id ? `/dashboard/wall#post-${row.post_id}` : "/dashboard/wall",
              icon: "❤️",
            });
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
  }, [qc, role, userId, navigate]);
}
