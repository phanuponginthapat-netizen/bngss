---
name: Unified Notifications (Phase 1 + 2)
description: Multi-channel fan-out via notify() helper + notify-fanout edge function. Phase 2 added retry queue and admin delivery dashboard.
type: feature
---

## Architecture
- Frontend: `src/lib/notify.ts` exports `notify(opts)` and `notifyRole(role, opts)`. ALWAYS use this instead of inserting into `notifications` directly.
- Edge: `supabase/functions/notify-fanout/index.ts` fans out to in_app, push, line, gchat respecting `notification_preferences` (channel toggle, quiet hours, severity floor, per-type override). Logs every attempt to `notification_delivery_log`.
- Retry: `supabase/functions/notify-retry/index.ts` re-runs failed push entries from the last 60 min (once per row, marked with `retry:done` in reason).
- Push transient failures (429 / 5xx) are auto-retried once inside fanout with 400 ms backoff before being marked failed.

## Settings
- User settings UI: `/dashboard/settings/notifications` → `src/pages/NotificationSettingsPage.tsx`.
- Admin delivery dashboard: `/dashboard/admin/notifications` → `src/pages/admin/NotificationDeliveryDashboard.tsx` (admin/director only). Filters by range/channel/status/type, manual "Retry failed push" button.

## Migrated triggers (use notify())
- Homework (assign → students)
- E-Form send (`SendEFormDialog`)
- Staff leave approval (`StaffLeavePage`)
- Substitute assignment (`SubstitutePage`)
- Documents (`admin/DocumentPage`)
- News publish & emergency broadcasts (`admin/NewsPage`) — emergency fans to all + gchat; critical bypasses quiet hours.
- Student behavior records → student account
- Student leave submit + approve/reject (`StudentLeavePage`, `LiffLeavePage`)
- Daily attendance absent/late → student (dedup_key per date)
- ICT overdue (`notify-ict-overdue`) → borrower (warning, multi-channel) + admins (in_app only)

## Conventions
- `dedup_key` per logical event to prevent duplicate sends within 60 s.
- `severity: "critical"` ignores quiet hours and minimum severity gates.
- Use `channels: ["in_app"]` for noisy admin-only events.
- Use `gchat_categories: ["all"]` for broad announcements; webhook routing comes from `google_chat_webhooks`.
