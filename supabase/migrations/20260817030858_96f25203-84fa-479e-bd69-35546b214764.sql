alter table public.pp5_files
  add column if not exists parsed_data jsonb,
  add column if not exists parse_status text default 'pending',
  add column if not exists announced_at timestamptz,
  add column if not exists announced_by uuid,
  add column if not exists applied_at timestamptz,
  add column if not exists classroom_id uuid;

alter table public.pp6_files
  add column if not exists parsed_data jsonb,
  add column if not exists parse_status text default 'pending',
  add column if not exists announced_at timestamptz,
  add column if not exists announced_by uuid,
  add column if not exists applied_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='pp5_files_classroom_id_fkey') then
    alter table public.pp5_files add constraint pp5_files_classroom_id_fkey
      foreign key (classroom_id) references public.classrooms(id) on delete set null;
  end if;
end $$;

create index if not exists idx_pp5_files_lookup on public.pp5_files(academic_year, semester, grade_level);
create index if not exists idx_pp6_files_lookup on public.pp6_files(academic_year, semester, grade_level);