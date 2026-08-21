-- เพิ่มฟิลด์ราชการให้อาหารกลางวัน + โฮมรูม
-- school_lunch_records: งบ/แหล่งทุน/โภชนาการ 5 หมู่
alter table public.school_lunch_records add column if not exists budget_per_head numeric default 22;
alter table public.school_lunch_records add column if not exists funding_source text default 'สพฐ.';
alter table public.school_lunch_records add column if not exists nutrition_5groups text[] default array[]::text[];
alter table public.school_lunch_records add column if not exists menu_detail jsonb default '{}'::jsonb;

-- home_visits: ensure kosor01_data exists (already added 20260424) + add missing กสศ.01 fields if not
alter table public.home_visits add column if not exists family_status text;
alter table public.home_visits add column if not exists living_with text;
alter table public.home_visits add column if not exists welfare_received boolean default false;
alter table public.home_visits add column if not exists housing_type text;
alter table public.home_visits add column if not exists housing_rent numeric;
