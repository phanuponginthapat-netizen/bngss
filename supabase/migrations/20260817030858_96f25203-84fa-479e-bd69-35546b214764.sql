DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'alter table public.pp5_files
      add column if not exists parsed_data jsonb,
      add column if not exists parse_status text default ''pending'',
      add column if not exists announced_at timestamptz,
      add column if not exists announced_by uuid,
      add column if not exists applied_at timestamptz,
      add column if not exists classroom_id uuid';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'alter table public.pp6_files
      add column if not exists parsed_data jsonb,
      add column if not exists parse_status text default ''pending'',
      add column if not exists announced_at timestamptz,
      add column if not exists announced_by uuid,
      add column if not exists applied_at timestamptz';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
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
