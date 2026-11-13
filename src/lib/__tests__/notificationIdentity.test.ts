import { describe, expect, it } from "vitest";
import { notificationEventTag, uniqueInboxNotifications } from "../notificationIdentity";

describe("single notification across delivery channels", () => {
  it("uses one identity for the notification and its inbox mirror", () => {
    expect(notificationEventTag("inbox_items", { id: "mirror", notification_id: "original" }))
      .toBe(notificationEventTag("notifications", { id: "original" }));
  });
  it("shows two mirrors as one while preserving read state without mutating source", () => {
    const rows = [{ id: "a", notification_id: "n", is_read: false }, { id: "b", notification_id: "n", is_read: true }];
    const result = uniqueInboxNotifications(rows);
    expect(result).toHaveLength(1);
    expect(result[0].is_read).toBe(true);
    expect(rows[0].is_read).toBe(false);
  });
  it("keeps distinct events and standalone messages", () => {
    expect(uniqueInboxNotifications([{ id: "a", notification_id: "n1" }, { id: "b", notification_id: "n2" }, { id: "c" }, { id: "d" }])).toHaveLength(4);
    expect(notificationEventTag("notifications", { id: "n1" })).not.toBe(notificationEventTag("notifications", { id: "n2" }));
  });
});