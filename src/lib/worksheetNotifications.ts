import { notify, type NotifyOptions } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";

export function worksheetNotice(event: "created" | "updated" | "submitted" | "graded", id: string, title: string, userIds: string[], detail = ""): NotifyOptions {
  const headings = { created: "ใบงานใหม่", updated: "ครูแก้ไขใบงาน", submitted: "นักเรียนส่งใบงาน", graded: "ครูตรวจใบงานแล้ว" };
  return { user_ids: [...new Set(userIds)], title: `${headings[event]}: ${title}`, body: detail, type: event === "submitted" ? "homework_submitted" : event === "graded" ? "homework_graded" : "homework", reference_id: id, reference_type: "homework_assignments", url: `/dashboard/homework?worksheet=${encodeURIComponent(id)}`, channels: ["in_app", "push", "line"] };
}

export async function notifyWorksheetClass(event: "created" | "updated", id: string, title: string, classroomId: string, dueDate: string) {
  const students = await fetchAllRows<{ auth_user_id: string | null }>((from, to) => supabase.from("students").select("auth_user_id").eq("classroom_id", classroomId).eq("status", "active").not("auth_user_id", "is", null).order("id").range(from, to));
  const ids = students.map(s => s.auth_user_id).filter((id): id is string => !!id);
  await notify(worksheetNotice(event, id, title, ids, dueDate ? `กำหนดส่ง ${new Date(dueDate).toLocaleDateString("th-TH")}` : "มีใบงานใหม่ในห้องเรียน"));
}