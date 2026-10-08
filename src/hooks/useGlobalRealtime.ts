import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
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
  // เพิ่มค่าเพื่อสร้างช่องสัญญาณใหม่เมื่อหลุด (มือถือพักแอป/เน็ตหลุด)
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    // Wait for both userId and role to resolve before subscribing.
    // Subscribing as "anon" then re-subscribing as the real role caused a redundant
    // mass invalidateQueries() on the first connect.
    if (!userId || !role) return;


    // ⚡ ประสิทธิภาพ: การผูก realtime 1 ตาราง = ตัวกรอง WAL 1 ชุดต่อผู้ใช้ 1 คน
    // เดิม admin ผูกเกือบ 100 ตาราง × ผู้ใช้ทุกคน → ฐานข้อมูลต้องกรอง WAL หนักมาก
    // จนระบบหน่วง/ค้างเป็นช่วง ๆ  จึงเหลือเฉพาะตาราง "ร้อน" ที่ต้องเห็นสดจริง ๆ
    // ตารางอื่นยังอัปเดตเมื่อเปิดหน้านั้น/สลับกลับมาที่แท็บ ผ่าน react-query ตามปกติ

    // Tables every authenticated user needs (notifications/inbox/news/eforms)
    const baseTables = [
      "notifications", "inbox_items", "news_posts",
      "emergency_broadcasts", "eform_recipients", "document_recipients",
      "wall_post_comments", "wall_post_reactions",
    ];

    // Admin/Director: เฉพาะงานที่ต้องเห็นสด (เช็คชื่อ/สแกนหน้า/ทะเบียนนักเรียน)
    const adminTables = [
      "students", "classrooms", "personnel",
      "attendance", "face_scan_logs", "student_leaves", "behavior_records",
      "student_scores", "schedules", "homework_assignments", "task_assignments",
      "documents", "staff_leaves", "admissions",
    ];

    // Teacher: ห้องเรียน/วิชาที่สอน
    const teacherTables = [
      "students", "classrooms", "attendance", "behavior_records", "student_leaves",
      "student_scores", "student_column_scores", "schedules",
      "homework_assignments", "homework_submissions", "task_assignments",
      "documents", "staff_leaves",
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
      attendance: [["dashboard_stats_v2"], ["mascot_stats"], ["face-report-accurate"], ["face-logs-range"], ["face-chart"]],
      personnel: [["my_personnel"], ["dashboard_stats_v2"]],
      news_posts: [["dashboard_stats_v2"]],
      academic_events: [["dashboard_stats_v2"]],
      face_scan_logs: [["dashboard_stats_v2"], ["mascot_stats"], ["face-report-accurate"], ["face-logs-range"], ["face-chart"]],
       notifications: [["notifications"], ["my_notifications", userId]],
       inbox_items: [["my_inbox_items", userId]],
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
    const flushInvalidations = () => {
      invalidationTimer = null;
      const batch = Array.from(pendingInvalidations.values());
      pendingInvalidations.clear();
      // refetchType: "active" → ยิงใหม่เฉพาะ query ที่หน้าจอกำลังใช้จริง
      // ส่วนที่อยู่เบื้องหลังแค่ mark stale ไว้ ดึงตอนกลับไปหน้านั้น (ลดโหลด DB มาก)
      for (const key of batch) qc.invalidateQueries({ queryKey: key, refetchType: "active" });
    };
    const scheduleInvalidate = (keys: string[][]) => {
      for (const key of keys) {
        const sig = JSON.stringify(key);
        if (!pendingInvalidations.has(sig)) pendingInvalidations.set(sig, key);
      }
      if (invalidationTimer !== null) return;
      // แท็บที่ซ่อนอยู่: หน่วงยาวขึ้น (ไม่ต้องรีบ) — ลดคำขอพร้อมกันทั้งโรงเรียน
      const delay = document.visibilityState === "visible" ? 400 : 3000;
      invalidationTimer = window.setTimeout(flushInvalidations, delay);
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

    let didFirstSubscribe = false;
    let disposed = false;
    let reconnectTimer: number | null = null;
    channel.subscribe((status) => {
      // On reconnect only: invalidate the hot user-scoped queries, not the whole cache.
      // (Blanket invalidateQueries() with 500+ users online = refetch storm)
      if (status === "SUBSCRIBED" && didFirstSubscribe) {
         scheduleInvalidate([["notifications"], ["inbox_items"], ["my_notifications", userId], ["my_inbox_items", userId], ["dashboard_stats_v2"]]);
      }
      if (status === "SUBSCRIBED") didFirstSubscribe = true;
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (disposed || reconnectTimer !== null) return;
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          if (!disposed) setReconnectKey((k) => k + 1);
        }, 3000);
      }
    });

    // Force resync when tab becomes visible or network restored — throttled
    let lastResync = 0;
    const resync = () => {
      const now = Date.now();
      if (now - lastResync < 5000) return; // ≤ 1 resync ต่อ 5 วิ
      lastResync = now;
       scheduleInvalidate([["notifications"], ["inbox_items"], ["my_notifications", userId], ["my_inbox_items", userId]]);
       void import("@/lib/fcmPush").then(({ flushPendingFcmToken }) => flushPendingFcmToken()).catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", onVisible);

    // แอป APK/IPA: เมื่อกลับมาเปิดแอป ให้ดึงแจ้งเตือนล่าสุด และต่อสัญญาณใหม่ถ้าหลุด
    let removeResume: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(({ App }) =>
        App.addListener("resume", () => {
          resync();
          if (channel.state !== "joined" && !disposed) setReconnectKey((k) => k + 1);
        }),
      ).then((h) => { if (disposed) h.remove(); else removeResume = () => h.remove(); }).catch(() => {});
    }

    return () => {
      disposed = true;
      removeResume?.();
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", onVisible);
      if (invalidationTimer !== null) clearTimeout(invalidationTimer);
      supabase.removeChannel(channel);
    };
  }, [qc, role, userId, navigate, reconnectKey]);
}
