---
name: Google Chat notifications
description: ครอบคลุม Google Chat triggers + รายงานสรุปประจำวัน/เดือน/ภาคเรียน
type: feature
---
Coverage parity with LINE — triggers fire via notify_google_chat → notify-google-chat edge function:
- attendance(absent), behavior(positive/negative + serious), face_scan, score
- news, emergency, documents, eforms (sent/signed/rejected), eform_recipients
- staff_leaves (request + approved), student_leaves (request + approved), substitute_teaching
- ict_loans (borrow/return), asset_damage_reports (report/resolved)
- garbage_deposits (≥20 pts to reduce spam), garbage_user_badges

Departments: student_affairs, general_admin, hr, academic, all.

Summary reports: edge function `gchat-summary` aggregates counts for daily|monthly|term and posts 4 cards (student_affairs / general_admin / hr / all).
pg_cron jobs (UTC):
- gchat-summary-daily `0 10 * * *` → 17:00 BKK
- gchat-summary-monthly `0 1 1 * *` → 1st 08:00 BKK
- gchat-summary-term `0 1 15 5,11 *` → 15 May & 15 Nov 08:00 BKK
Admin can trigger manually from WebhookManagementPage dropdown "ส่งรายงานสรุปทันที".

notification_types vocabulary extended: student_leave, eform, ict_loan, asset_damage, garbage, face_scan, score, summary.
