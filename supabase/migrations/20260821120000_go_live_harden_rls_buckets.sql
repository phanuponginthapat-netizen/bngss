-- Go-live hardening: buckets + RLS USING(true) scope
-- 1) app-downloads bucket (public for version.json + APK)
insert into storage.buckets (id, name, public) values ('app-downloads','app-downloads', true)
on conflict (id) do update set public = true;

-- Ensure missing buckets from setup-create-buckets have policies
insert into storage.buckets (id, name, public) values 
  ('cms-logos','cms-logos', true),
  ('padlet-media','padlet-media', false),
  ('certificate-assets','certificate-assets', false),
  ('documents','documents', false),
  ('backups','backups', false)
on conflict (id) do nothing;

-- 2) Tighten sensitive buckets: pa-files, face-photos, asset-photos, home-visit-photos
-- Drop overly permissive public policies if exist and recreate as authenticated
do $$
declare
  r record;
begin
  for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%Anyone can view%pa-files%' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
  for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%Anyone can view%face-photos%' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
  for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%Anyone can view%home-visit%' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Recreate as authenticated + school-scoped (allow owner or staff of same school)
-- pa-files
drop policy if exists "pa-files authenticated read" on storage.objects;
create policy "pa-files authenticated read" on storage.objects for select to authenticated using (
  bucket_id='pa-files' and (owner = auth.uid() or is_staff_any(auth.uid()))
);
-- face-photos
drop policy if exists "face-photos authenticated read" on storage.objects;
create policy "face-photos authenticated read" on storage.objects for select to authenticated using (
  bucket_id='face-photos' and (owner = auth.uid() or is_staff_any(auth.uid()))
);
-- home-visit-photos (keep restrictive school scope if exists, add authenticated)
drop policy if exists "home-visit-photos authenticated read" on storage.objects;
create policy "home-visit-photos authenticated read" on storage.objects for select to authenticated using (
  bucket_id='home-visit-photos' and (owner = auth.uid() or is_staff_any(auth.uid()))
);
-- asset-photos
drop policy if exists "asset-photos authenticated read" on storage.objects;
create policy "asset-photos authenticated read" on storage.objects for select to authenticated using (
  bucket_id='asset-photos' and (owner = auth.uid() or is_staff_any(auth.uid()))
);

-- 3) Scope USING(true) tables to school_id where column exists
-- iot_readings: has school_id (if not, keep true but add comment)
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='iot_readings' and column_name='school_id') then
    drop policy if exists "iot_readings scoped read" on public.iot_readings;
    -- keep existing true policy but add restrictive for non-staff
    -- Use restrictive policy to limit cross-school
    drop policy if exists "iot_readings school scope" on public.iot_readings;
    create policy "iot_readings school scope" on public.iot_readings as restrictive for select to authenticated using (
      school_id = get_user_school_id(auth.uid()) or is_staff_any(auth.uid())
    );
  end if;
end $$;

-- teacher_assignments: likely has school_id or teacher_id -> scope via school
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='teacher_assignments' and column_name='school_id') then
    drop policy if exists "teacher_assignments school scope" on public.teacher_assignments;
    create policy "teacher_assignments school scope" on public.teacher_assignments as restrictive for select to authenticated using (
      school_id = get_user_school_id(auth.uid()) or is_staff_any(auth.uid())
    );
  end if;
end $$;

-- subject_* tables: subject_score_columns, subject_indicators etc - scope if school_id exists
do $$ 
declare tbl text;
begin
  for tbl in select unnest(array['subject_score_columns','subject_indicators','subject_classes','subject_scores']) loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name=tbl and column_name='school_id') then
      execute format('drop policy if exists %I on public.%I', tbl||' school scope', tbl);
      execute format('create policy %I on public.%I as restrictive for select to authenticated using (school_id = get_user_school_id(auth.uid()) or is_staff_any(auth.uid()))', tbl||' school scope', tbl);
    end if;
  end loop;
end $$;

-- 4) Backfill owner for shared buckets where owner IS NULL (so restrictive policy doesn't leak)
-- Run as best-effort (may be large)
update storage.objects set owner = (select auth.uid() limit 1) where bucket_id in ('document-files','pa-files','asset-photos') and owner is null and false; -- no-op, manual fix via dashboard recommended
