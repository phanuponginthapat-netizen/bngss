DO $guard$
BEGIN
  EXECUTE 'alter table public.pp5_files
  add column if not exists parsed_data jsonb,
  add column if not exists parse_status text default ''pending'',
  add column if not exists announced_at timestamptz,
  add column if not exists announced_by uuid,
  add column if not exists applied_at timestamptz,
  add column if not exists classroom_id uuid';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'alter table public.pp6_files
  add column if not exists parsed_data jsonb,
  add column if not exists parse_status text default ''pending'',
  add column if not exists announced_at timestamptz,
  add column if not exists announced_by uuid,
  add column if not exists applied_at timestamptz';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pp5_files_classroom_id_fkey') then
    alter table public.pp5_files add constraint pp5_files_classroom_id_fkey
      foreign key (classroom_id) references public.classrooms(id) on delete set null;
  end if;
end $$;
DO $idxguard$
BEGIN
  EXECUTE 'create index if not exists idx_pp5_files_lookup on public.pp5_files(academic_year, semester, grade_level)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'create index if not exists idx_pp6_files_lookup on public.pp6_files(academic_year, semester, grade_level)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
