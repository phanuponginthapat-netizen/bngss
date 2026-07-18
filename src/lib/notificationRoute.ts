// Shared routing for notifications & inbox items.
// Given a row with reference_type/type + reference_id, return the target route.
export function routeForNotification(
  n: {
    reference_type?: string | null;
    reference_table?: string | null;
    type?: string | null;
    category?: string | null;
    item_type?: string | null;
    reference_id?: string | null;
    action_url?: string | null;
  },
  role?: string | null,
): string | null {
  // นักเรียน/ผู้ปกครอง: ห้ามพาไปหน้า "สแกนเข้าเรียน" (เป็นหน้าสำหรับครู/แอดมิน)
  // ให้ไปดูประวัติการมาโรงเรียนของตัวเองแทน
  const isStudentSide = role === "student" || role === "parent";
  if (isStudentSide && n.action_url && /\/dashboard\/student\/face-scan/.test(n.action_url)) {
    return "/dashboard/student/attendance";
  }
  if (n.action_url) return n.action_url;
  // Prefer the explicit notification type (e.g. "homework", "exam") over the
  // underlying reference table (e.g. "task_assignments") so a homework notif
  // routes to /dashboard/homework instead of back to the inbox.
  // Skip generic placeholder values like "notification" / "system" so a
  // useful reference_table (e.g. "task_assignments") wins instead.
  // "leave" alone is ambiguous (student vs staff) — let reference_type/table decide.
  const generic = new Set(["notification", "notifications", "system", "info", "general", "leave", ""]);
  const candidates = [n.type, n.item_type, n.category, n.reference_type, n.reference_table];
  const t = candidates.find((c) => c && !generic.has(String(c).toLowerCase())) || "";
  const id = n.reference_id;
  const withHighlight = (path: string) => (id ? `${path}${path.includes("?") ? "&" : "?"}highlight=${id}` : path);
  switch (t) {
    case "staff_leave":
    case "staff_leaves":
    case "staff_leave_approved":
      return withHighlight("/dashboard/hr/leave");
    case "student_leave":
    case "student_leaves":
    case "student_leave_decision":
      return withHighlight("/dashboard/student/leave");
    case "document":
    case "documents":
      return id ? `/dashboard/inbox?tab=documents&doc=${id}` : "/dashboard/inbox?tab=documents";
    case "eform":
    case "eforms":
    case "eform_recipient":
      return id ? `/dashboard/inbox?tab=eform&doc=${id}` : "/dashboard/inbox?tab=eform";
    case "news":
    case "news_posts":
      return id ? `/dashboard/news/${id}` : "/dashboard/admin/news";
    case "news_draft":
    case "announcement":
      return withHighlight("/dashboard/admin/news");
    case "behavior":
    case "behavior_records":
    case "behavior_record":
      return withHighlight("/dashboard/student/behavior");
    case "attendance":
    case "attendance_absent":
    case "attendance_daily_report":
    case "daily_report":
      return withHighlight("/dashboard/student/attendance");
    case "score":
    case "student_score":
    case "student_scores":
      return withHighlight("/dashboard/student/attendance");
    case "homework":
    case "homework_submitted":
    case "homework_graded":
      return withHighlight("/dashboard/homework");
    case "exam":
      return id ? `/dashboard/exam/${id}` : "/dashboard/exam";
    case "task":
    case "task_assignment":
    case "task_assignments":
      return withHighlight("/dashboard/homework");
    case "asset_damage":
    case "asset_damage_report":
    case "damage":
      return withHighlight("/dashboard/finance/assets");
    case "ict_loan":
    case "ict_loans":
      return withHighlight("/dashboard/admin/ict-loans");
    case "substitute_teaching":
      return withHighlight("/dashboard/hr/substitute");
    case "face_scan":
    case "face_scan_log":
    case "face_scan_logs":
      return isStudentSide ? "/dashboard/student/attendance" : "/dashboard/student/face-scan";
    case "emergency":
    case "emergency_broadcasts":
      return withHighlight("/dashboard/emergency");
    case "garbage_points":
    case "garbage_deposit":
    case "garbage_redemption":
    case "garbage_badge":
    case "garbage":
      return "/dashboard/garbage/my";
    case "wall_reaction":
    case "wall_comment":
    case "wall_reply":
    case "wall_post":
      return withHighlight("/dashboard");
    case "ai_risk":
      return "/dashboard";
    default:
      return null;
  }
}

