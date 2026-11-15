export const SCAN_RECEIPT_EVENT = "facegate:receipt";
export const scanQueryAffected = (key: readonly unknown[]) => {
  const name = String(key[0] ?? "");
  return /attendance|face-logs|face-chart|face-report|homeroom_dashboard|spider_attend|student.*scan|scan.*student/.test(name)
    || ["dashboard_stats_v3","director_dashboard_stats","student_dashboard","subject_dashboard","teacher_daily_briefing","teacher_attendance_trend"].includes(name);
};