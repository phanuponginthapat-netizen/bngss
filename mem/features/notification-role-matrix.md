---
name: Role Notification Matrix
description: Per-role x per-category notification routing (in-app/push/LINE/gchat) with min-severity threshold. User prefs can further disable but not re-enable.
type: feature
---

## Table: `public.role_notification_defaults`
Columns: `role, category, in_app, push, line, gchat, min_severity`
- `role` ∈ admin/director/teacher/student/parent/alumni
- `category` matches `categoryOf()` in `notify-fanout`: critical/attendance/behavior/health/homework/score/eform/leave/ict/news/other
- RLS: everyone can SELECT; only admin/director can INSERT/UPDATE/DELETE
- Seeded on migration `20260718-172533` — 60+ rows

## Precedence in `notify-fanout/index.ts`
1. **School-wide category routing** (`school_settings.channel_category_routing`) — cuts gchat/line for whole category
2. **Role matrix default** (this table) — baseline per role
3. **User preference** (`notification_preferences`) — can further disable, cannot override role=off

## Admin UI
`/dashboard/admin/notification-matrix` — `NotificationMatrixPage.tsx` — tab per role, table per category, batch save via upsert on (role, category).

## Do not
- Do not gate `in_app` off for `admin` on `critical` — admins must always see emergency broadcasts
- Do not remove `alumni` `critical` / `news` — the only two categories alumni get
