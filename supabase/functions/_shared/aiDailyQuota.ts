export function bangkokDayStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00+07:00`).toISOString();
}
export async function checkDailyChatQuota(db: any, userId: string, limit: number, now = new Date()): Promise<"allowed" | "limited" | "unavailable"> {
  try {
    const { count, error } = await db.from("ai_chat_logs").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("role", "user").gte("created_at", bangkokDayStart(now));
    if (error || count == null) return "unavailable";
    return count >= limit ? "limited" : "allowed";
  } catch { return "unavailable"; }
}