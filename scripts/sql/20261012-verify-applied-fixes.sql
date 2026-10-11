-- ตรวจว่าชุดคำสั่งแก้ถูกรันครบแล้วหรือยัง
-- วิธีใช้: วางทั้งไฟล์ใน SQL editor ของเซิร์ฟเวอร์โรงเรียน แล้วกดรัน
-- อ่านคอลัมน์ "สถานะ": ✓ แก้แล้ว / ✗ ยังไม่ได้รัน

with checks as (
  select
    '1. แก้ error 42501 (policy อัปเดต push_subscriptions)' as รายการ,
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'push_subscriptions'
        and policyname = 'Users can update own subscriptions'
        and cmd = 'UPDATE'
    ) then '✓ แก้แล้ว' else '✗ ยังไม่ได้รัน (20261012-push-subscriptions-rls-upsert.sql)' end as สถานะ
  union all
  select
    '2. ฟังก์ชัน register_push_subscription (บันทึกเครื่องรับแจ้งเตือนแบบทับของเดิม)',
    case when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'register_push_subscription'
        and p.prosrc like '%ON CONFLICT (user_id, endpoint)%'
    ) then '✓ แก้แล้ว' else '✗ ยังไม่ได้รัน (20261012-push-subscriptions-rls-upsert.sql)' end
  union all
  select
    '3. แก้ error 42703 ตอนตี 2:30 (prune_operational_data เลือกคอลัมน์เวลาให้ถูกตาราง)',
    case when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'prune_operational_data'
        and p.prosrc like '%skipped%'
    ) then '✓ แก้แล้ว' else '✗ ยังไม่ได้รัน (20261009-fix-prune-and-app-downloads.sql)' end
  union all
  select
    '4. ขยายเพดานไฟล์ app-downloads เป็น 200 MB (แก้อัปโหลด APK ล้มเหลว)',
    case when coalesce(
      (select file_size_limit from storage.buckets where id = 'app-downloads'), 0
    ) = 209715200 then '✓ แก้แล้ว' else '✗ ยังไม่ได้รัน (20261009-fix-prune-and-app-downloads.sql)' end
  union all
  select
    '5. โควตาพื้นที่ app-downloads เป็น 400 MB / เก็บ 2 รุ่นล่าสุด',
    case when exists (
      select 1 from public.storage_tier_policies
      where bucket = 'app-downloads' and quota_mb = 400 and keep_recent = 2
    ) then '✓ แก้แล้ว' else '✗ ยังไม่ได้รัน (20261009-fix-prune-and-app-downloads.sql)' end
)
select รายการ, สถานะ from checks
order by รายการ;
