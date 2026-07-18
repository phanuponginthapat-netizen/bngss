// Dashboard widget registry — defines all available widgets for the admin dashboard
// Each widget can be toggled on/off, resized, and color-themed per user.

export type WidgetSize = "sm" | "md" | "lg" | "xl";
export type WidgetColor =
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "info"
  | "rose"
  | "violet"
  | "neutral";

export interface WidgetDef {
  key: string;
  titleTh: string;
  titleEn: string;
  group: "overview" | "kpi" | "chart" | "info" | "shortcut";
  defaultSize: WidgetSize;
  defaultColor: WidgetColor;
  allowedSizes: WidgetSize[];
  required?: boolean; // cannot be hidden
  defaultEnabled?: boolean;
}

export const DASHBOARD_WIDGETS: WidgetDef[] = [
  { key: "hero", titleTh: "ส่วนหัว/ทักทาย", titleEn: "Hero greeting", group: "overview", defaultSize: "lg", defaultColor: "primary", allowedSizes: ["lg", "xl"], required: true, defaultEnabled: true },
  { key: "today_actions", titleTh: "ต้องทำวันนี้", titleEn: "Today's Actions", group: "overview", defaultSize: "md", defaultColor: "primary", allowedSizes: ["md", "lg", "xl"], defaultEnabled: true },
  { key: "ai_insights", titleTh: "AI วิเคราะห์", titleEn: "AI Insights", group: "overview", defaultSize: "md", defaultColor: "violet", allowedSizes: ["md", "lg", "xl"], defaultEnabled: true },
  { key: "mascot_hero", titleTh: "การ์ดมาสคอต", titleEn: "Mascot Card", group: "overview", defaultSize: "lg", defaultColor: "primary", allowedSizes: ["md", "lg", "xl"], defaultEnabled: true },
  { key: "alerts", titleTh: "แจ้งเตือนด่วน", titleEn: "Quick alerts", group: "overview", defaultSize: "md", defaultColor: "info", allowedSizes: ["md", "lg", "xl"], defaultEnabled: true },

  { key: "kpi_students", titleTh: "นักเรียน", titleEn: "Students", group: "kpi", defaultSize: "sm", defaultColor: "primary", allowedSizes: ["sm", "md"], defaultEnabled: true },
  { key: "kpi_personnel", titleTh: "บุคลากร", titleEn: "Personnel", group: "kpi", defaultSize: "sm", defaultColor: "accent", allowedSizes: ["sm", "md"], defaultEnabled: true },
  { key: "kpi_classrooms", titleTh: "ห้องเรียน", titleEn: "Classrooms", group: "kpi", defaultSize: "sm", defaultColor: "warning", allowedSizes: ["sm", "md"], defaultEnabled: true },
  { key: "kpi_attendance", titleTh: "อัตราเข้าเรียน", titleEn: "Attendance %", group: "kpi", defaultSize: "sm", defaultColor: "success", allowedSizes: ["sm", "md"], defaultEnabled: true },
  { key: "kpi_balance", titleTh: "งบคงเหลือ", titleEn: "Balance", group: "kpi", defaultSize: "sm", defaultColor: "info", allowedSizes: ["sm", "md"], defaultEnabled: true },
  { key: "kpi_assets", titleTh: "สินทรัพย์", titleEn: "Assets", group: "kpi", defaultSize: "sm", defaultColor: "violet", allowedSizes: ["sm", "md"], defaultEnabled: true },

  { key: "attendance_donut", titleTh: "การมาเรียนวันนี้", titleEn: "Today's Attendance", group: "chart", defaultSize: "md", defaultColor: "success", allowedSizes: ["md", "lg"], defaultEnabled: true },
  { key: "budget_trend", titleTh: "รายรับ-รายจ่าย 6 เดือน", titleEn: "Budget 6-month trend", group: "chart", defaultSize: "lg", defaultColor: "info", allowedSizes: ["md", "lg", "xl"], defaultEnabled: true },
  { key: "school_radar", titleTh: "กราฟใยแมงมุมโรงเรียน", titleEn: "School Radar", group: "chart", defaultSize: "md", defaultColor: "violet", allowedSizes: ["md", "lg"], defaultEnabled: true },

  { key: "news", titleTh: "ข่าวสารล่าสุด", titleEn: "Latest News", group: "info", defaultSize: "md", defaultColor: "primary", allowedSizes: ["md", "lg"], defaultEnabled: true },
  { key: "calendar", titleTh: "ปฏิทินกิจกรรม", titleEn: "Event Calendar", group: "info", defaultSize: "md", defaultColor: "warning", allowedSizes: ["md", "lg"], defaultEnabled: true },
  { key: "student_care", titleTh: "ระบบดูแลนักเรียน", titleEn: "Student Care", group: "info", defaultSize: "md", defaultColor: "rose", allowedSizes: ["md", "lg"], defaultEnabled: true },

  { key: "mini_apps", titleTh: "มินิแอป (ทางลัด)", titleEn: "Mini Apps", group: "shortcut", defaultSize: "xl", defaultColor: "primary", allowedSizes: ["lg", "xl"], defaultEnabled: true },
  
  { key: "iot_summary", titleTh: "IoT", titleEn: "IoT", group: "shortcut", defaultSize: "md", defaultColor: "info", allowedSizes: ["md", "lg"], defaultEnabled: true },
  
  { key: "social_wall", titleTh: "Social Wall", titleEn: "Social Wall", group: "info", defaultSize: "lg", defaultColor: "info", allowedSizes: ["md", "lg", "xl"], defaultEnabled: true },
];

// Tailwind classes per color theme — used for icon backgrounds and accent strips
export const COLOR_THEMES: Record<WidgetColor, { gradient: string; soft: string; text: string; ring: string; label: string; labelEn: string }> = {
  primary: { gradient: "gradient-primary", soft: "bg-primary/10", text: "text-primary", ring: "ring-primary/30", label: "ฟ้า", labelEn: "Blue" },
  accent: { gradient: "gradient-accent", soft: "bg-accent/10", text: "text-accent", ring: "ring-accent/30", label: "ม่วงเขียว", labelEn: "Teal" },
  success: { gradient: "gradient-success", soft: "bg-success/15", text: "text-success", ring: "ring-success/30", label: "เขียว", labelEn: "Green" },
  warning: { gradient: "gradient-warning", soft: "bg-warning/15", text: "text-warning", ring: "ring-warning/30", label: "ส้ม", labelEn: "Orange" },
  info: { gradient: "gradient-info", soft: "bg-info/10", text: "text-info", ring: "ring-info/30", label: "ฟ้าน้ำทะเล", labelEn: "Sky" },
  rose: { gradient: "bg-gradient-to-br from-danger to-danger", soft: "bg-danger/10", text: "text-danger", ring: "ring-danger/30", label: "ชมพู", labelEn: "Rose" },
  violet: { gradient: "bg-gradient-to-br from-info to-danger", soft: "bg-info/10", text: "text-info", ring: "ring-info/30", label: "ม่วง", labelEn: "Violet" },
  neutral: { gradient: "bg-gradient-to-br from-neutral to-neutral", soft: "bg-neutral/10", text: "text-neutral dark:text-neutral", ring: "ring-neutral/30", label: "เทา", labelEn: "Slate" },
};

// Map widget size → col-span on a 6-col lg grid (mobile is 2-col base)
export const SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: "col-span-1 lg:col-span-1",
  md: "col-span-2 lg:col-span-2",
  lg: "col-span-2 lg:col-span-3",
  xl: "col-span-2 lg:col-span-6",
};

export const SIZE_LABELS: Record<WidgetSize, { th: string; en: string }> = {
  sm: { th: "เล็ก", en: "S" },
  md: { th: "กลาง", en: "M" },
  lg: { th: "ใหญ่", en: "L" },
  xl: { th: "เต็ม", en: "XL" },
};
