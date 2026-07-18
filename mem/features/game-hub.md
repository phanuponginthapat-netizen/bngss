---
name: Game Hub
description: คลังเกม/บทเรียนโต้ตอบในระบบ + API สำหรับเกมภายนอก
type: feature
---
Tables: `game_hub_games`, `game_hub_scores`, `game_hub_api_keys`.
Storage bucket `game-covers` (private) — เข้าถึงผ่าน signed URL.

Routes:
- `/dashboard/games` — store (student/teacher/admin/parent)
- `/dashboard/games/:id` — detail + leaderboard แยกตาม band (kinder/primary_early/primary_late/secondary_lower/secondary_upper) + submit score
- `/dashboard/games/admin` — CRUD (teacher/admin) + อัปโหลดภาพปก
- `/dashboard/games/api-keys` — จัดการ API key (admin เท่านั้น)

Edge functions (verify_jwt=false, ใช้ header `x-hub-key`):
- `games-auth`: รับ `{ qr }` → verify key + resolve student จาก `/p/:uuid` → คืน session_token (HMAC-SHA256 กับ service_role, 15 นาที)
- `games-submit`: รับ `{ session_token, game_id, score, duration_sec, meta }`
- `games-leaderboard`: GET `?game_id=&band=&limit=` → best score/นักเรียน

Grade band helper: `src/lib/gameHubGrade.ts` (`gradeToBand`, `BAND_LABEL`, `gradeInRange`).
Game type: `external_link` (เปิดแท็บใหม่) หรือ `embed` (iframe srcdoc + sandbox="allow-scripts allow-forms allow-same-origin").
API key เก็บเป็น SHA-256 hash เท่านั้น + prefix 10 ตัวสำหรับแสดงผล.
