type NotificationIdentity = {
  id?: string;
  notification_id?: string | null;
};

/** Inbox mirrors and push deliveries use the original notification identity. */
export function notificationEventTag(table: string, row: NotificationIdentity): string {
  return table === "inbox_items" && row.notification_id
    ? `notifications-${row.notification_id}`
    : `${table}-${row.id || ""}`;
}

/** Collapse only exact mirrors, never distinct events with similar text. */
export function uniqueInboxNotifications<T extends NotificationIdentity & { is_read?: boolean }>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  const result: T[] = [];
  for (const row of rows) {
    if (!row.notification_id) { result.push(row); continue; }
    const existing = seen.get(row.notification_id);
    if (existing) {
      existing.is_read = !!existing.is_read || !!row.is_read;
      continue;
    }
    const copy = { ...row };
    seen.set(row.notification_id, copy);
    result.push(copy);
  }
  return result;
}