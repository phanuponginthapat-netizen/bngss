create table if not exists public.exam_bank (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  question text not null,
  choice_a text, choice_b text, choice_c text, choice_d text,
  correct_choice text check (correct_choice in ('A','B','C','D')),
  difficulty text check (difficulty in ('easy','medium','hard')) default 'medium',
  created_by uuid,
  created_at timestamptz default now()
);
alter table public.exam_bank enable row level security;
drop policy if exists "school read exam_bank" on public.exam_bank;
create policy "school read exam_bank" on public.exam_bank for select to authenticated using (school_id = public.get_user_school_id(auth.uid()) or school_id is null);
drop policy if exists "teacher manage exam_bank" on public.exam_bank;
create policy "teacher manage exam_bank" on public.exam_bank for all to authenticated using (public.has_role(auth.uid(),'teacher'::app_role) or public.has_role(auth.uid(),'admin'::app_role)) with check (true);
