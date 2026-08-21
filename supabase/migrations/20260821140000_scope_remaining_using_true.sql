-- Scope remaining USING(true) tables
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='school_milk_records' and column_name='school_id') then
    drop policy if exists "school_milk_records school scope" on public.school_milk_records;
    create policy "school_milk_records school scope" on public.school_milk_records as restrictive for select to authenticated using (school_id = get_user_school_id(auth.uid()) or is_staff_any(auth.uid()));
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='school_lunch_records' and column_name='school_id') then
    drop policy if exists "school_lunch_records school scope" on public.school_lunch_records;
    create policy "school_lunch_records school scope" on public.school_lunch_records as restrictive for select to authenticated using (school_id = get_user_school_id(auth.uid()) or is_staff_any(auth.uid()));
  end if;
  -- fallback for tables without school_id but with created_by/teacher_id -> keep true but log
end $$;
