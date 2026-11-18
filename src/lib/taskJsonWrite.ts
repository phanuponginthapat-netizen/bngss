import { supabase } from "@/integrations/supabase/client";
import { requireWrittenRows } from "./confirmedWrite";

type JsonColumn = "submissions" | "replies";
type JsonValue = Record<string, unknown> | unknown[];
type Store = {
  read: (taskId: string, column: JsonColumn) => Promise<{ value: JsonValue | null; error: unknown }>;
  compareWrite: (taskId: string, column: JsonColumn, expected: JsonValue, next: JsonValue) => Promise<{ data: unknown[] | null; error: unknown }>;
};

const store: Store = {
  async read(taskId, column) {
    const { data, error } = await supabase.from("task_assignments").select(column).eq("id", taskId).maybeSingle();
    return { value: data ? (data as unknown as Record<string, JsonValue>)[column] : null, error };
  },
  async compareWrite(taskId, column, expected, next) {
    // Compare-and-swap runs in the database so large JSON never travels in the URL (URL limits returned 400).
    const { data, error } = await supabase.rpc("compare_write_task_json", {
      _task_id: taskId, _column: column, _expected: expected as never, _next: next as never,
    });
    return { data: Array.isArray(data) ? data.map((id) => ({ id })) : null, error };
  },
};

/** Compare-and-swap the exact JSON version; never overwrite another caller's changes. */
export async function writeTaskJson(
  taskId: string, column: JsonColumn, transform: (current: JsonValue) => JsonValue,
  source: Store = store,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const read = await source.read(taskId, column);
    if (read.error) throw read.error;
    if (read.value === null) throw new Error("อ่านงานไม่สำเร็จ หรือคุณไม่มีสิทธิ์ กรุณาโหลดใหม่");
    const result = await source.compareWrite(taskId, column, read.value, transform(read.value));
    if (result.error) throw result.error;
    if (result.data?.length) { requireWrittenRows(result); return; }
  }
  throw new Error("งานมีการเปลี่ยนแปลงระหว่างบันทึก หรือคุณไม่มีสิทธิ์ กรุณาโหลดใหม่แล้วลองอีกครั้ง");
}