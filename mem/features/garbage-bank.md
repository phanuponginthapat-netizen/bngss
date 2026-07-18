---
name: Garbage Bank
description: ธนาคารขยะ — ฝาก/แลก/ประวัติ/รายงาน/แต้มของฉัน + role-based access
type: feature
---
Pages under /dashboard/garbage:
- /garbage (Dashboard) — staff (admin/director/teacher) realtime overview
- /garbage/counter — staff only POS-style ฝาก/แลก
- /garbage/items — everyone (students read-only via role check)
- /garbage/history — staff history with date range + type filter + CSV export
- /garbage/reports — admin/director report dashboard (daily/monthly/term, Recharts: LineChart, BarChart, PieChart, Top10)
- /garbage/my — student personal view (current points, deposits/redeem history, daily/monthly/term)

Sidebar group "ธนาคารขยะ" placed before "วิชาการ" so it sits right after "ลงเวลา" (in main items). Items filtered per role; students see only "แต้มของฉัน" + "ขยะ & รางวัล".

Tables: garbage_items, garbage_rewards, garbage_deposits, garbage_redemptions, garbage_student_points (cache). Triggers add_points_on_deposit + process_redemption already in DB.
Storage bucket: garbage-images (public).
