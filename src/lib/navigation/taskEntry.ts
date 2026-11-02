import type { AppRole } from "@/hooks/useUserRole";
import { buildWorkAreas, visibleWorkAreas, type NavigationItem } from "./workAreas";

export function safeTaskPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\r\n]/.test(path)) return "/dashboard";
  return path;
}

export function taskLoginUrl(path: string): string {
  return `/login?next=${encodeURIComponent(safeTaskPath(path))}`;
}

const priorities: Partial<Record<AppRole, string[]>> = {
  admin: ["academic/schedule", "student/attendance", "academic/score-status", "admin/staff-tasks", "admin/school-settings", "hub/communications"],
  director: ["admin/staff-tasks", "academic/score-status", "student/attendance", "hr/substitute", "hub/documents", "hub/communications"],
  teacher: ["academic/schedule", "student/attendance", "homework", "academic/score-status", "hr/leave", "hr/substitute"],
  student: ["academic/schedule", "homework", "student/leave", "student/my-face", "academic/calendar", "padlet"],
  alumni: ["profile", "portfolio", "feed", "members"],
};

export function priorityTasks(role: AppRole | null, lang: string, enabled: (key?: string | null) => boolean): NavigationItem[] {
  const items = visibleWorkAreas(buildWorkAreas(lang), role, enabled).flatMap(a => a.groups.flatMap(g => g.items));
  return (role ? priorities[role] ?? [] : []).flatMap(path => {
    const item = items.find(i => i.url === `/dashboard/${path}`);
    return item ? [item] : [];
  });
}