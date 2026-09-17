-- 2026-09-17 — เร่งความเร็วการอ่านข้อมูล (RLS initplan optimization)
--
-- ปัญหา: policy เขียน has_role(auth.uid(), ...) / is_staff_user(auth.uid()) ตรง ๆ
-- PostgreSQL จะเรียกฟังก์ชันนี้ "ทุกแถว" ทำให้ query ที่ข้อมูลไม่กี่พันแถว
-- ใช้เวลา 200–800 ms และเมื่อหลายคนใช้พร้อมกันระบบจะหน่วง/ค้าง
--
-- วิธีแก้มาตรฐานของ Supabase: ห่อ auth.uid() ด้วย (select auth.uid())
-- → planner ทำเป็น InitPlan คำนวณครั้งเดียวต่อ query
--
-- สคริปต์นี้ rewrite ทุก policy ของตารางที่ใช้งานหนัก แบบ idempotent
-- (ถ้ารันซ้ำจะไม่มีอะไรเปลี่ยน เพราะ pattern ถูกแทนไปแล้ว)

do $$
declare
  r record;
  new_qual text;
  new_check text;
  hot_tables text[] := array[
    'students','enrollments','attendance','face_scan_logs','student_scores',
    'student_column_scores','subject_score_columns','classrooms','subjects',
    'schedules','notifications','inbox_items','profiles','personnel',
    'homework_assignments','homework_submissions','task_assignments',
    'documents','document_recipients','eforms','eform_recipients',
    'behavior_records','student_leaves','news_posts','academic_events'
  ];
  sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = any(hot_tables)
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  loop
    -- แทน auth.uid() ที่ยังไม่ได้ห่อ ด้วย (select auth.uid())
    new_qual  := replace(coalesce(r.qual, ''),  'auth.uid()', '(select auth.uid())');
    new_check := replace(coalesce(r.with_check, ''), 'auth.uid()', '(select auth.uid())');

    -- กันกรณีที่ห่อไว้แล้ว (จะกลายเป็น (select (select auth.uid())) ) → ยุบกลับ
    new_qual  := replace(new_qual,  '(select (select auth.uid()) as uid)', '(select auth.uid())');
    new_check := replace(new_check, '(select (select auth.uid()) as uid)', '(select auth.uid())');
    new_qual  := replace(new_qual,  '(select (select auth.uid()))', '(select auth.uid())');
    new_check := replace(new_check, '(select (select auth.uid()))', '(select auth.uid())');

    sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if coalesce(r.qual, '') <> '' then
      sql := sql || format(' using (%s)', new_qual);
    end if;
    if coalesce(r.with_check, '') <> '' then
      sql := sql || format(' with check (%s)', new_check);
    end if;

    begin
      execute sql;
    exception when others then
      raise notice 'skip policy % on %: %', r.policyname, r.tablename, sqlerrm;
    end;
  end loop;
end $$;

analyze public.students;
analyze public.enrollments;
analyze public.attendance;
analyze public.face_scan_logs;
