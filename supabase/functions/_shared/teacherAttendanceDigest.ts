export function teacherDigestDue(minutes: number): boolean {
  return minutes >= 600 && minutes < 620;
}

export async function deliverTeacherDigest(sb: any, date: string, summary: string, sendPush: (payload: any) => Promise<Response | null>) {
  const users = new Set<string>();
  for (let start = 0; ; start += 500) {
    const { data, error } = await sb.from("user_roles").select("user_id").eq("role", "teacher").order("user_id").range(start, start + 499);
    if (error) throw error;
    for (const row of data ?? []) users.add(row.user_id);
    if ((data ?? []).length < 500) break;
    if (start >= 49500) throw new Error("Teacher recipient read incomplete");
  }
  let saved = 0;
  let alreadySent = 0;
  const newlySaved: string[] = [];
  for (const userId of users) {
    // Stable primary key provides atomic once-per-day persistence, even for overlapping invocations.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`teacher-attendance:${date}:${userId}`));
    const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
    const { error } = await sb.from("notifications").insert({ id, user_id: userId, title: `📊 สรุปการมาโรงเรียน ${date}`, message: summary,
      type: "attendance_digest", reference_type: "attendance_digest", is_read: false });
    if (error?.code === "23505") { alreadySent++; continue; }
    if (error) throw error;
    saved++;
    newlySaved.push(userId);
  }
  let pushAccepted = false;
  if (newlySaved.length) {
    const response = await sendPush({ user_ids: newlySaved, title: `📊 สรุปการมาโรงเรียน ${date}`, body: summary,
      type: "attendance_digest", channels: ["push"], url: "/dashboard/student/face-scan", dedup_key: `teacher-attendance:${date}` });
    pushAccepted = response?.ok === true;
  }
  return { recipients: users.size, saved, already_sent: alreadySent, push_accepted: pushAccepted };
}