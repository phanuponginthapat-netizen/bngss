-- Allow students to submit class-wide homework (assigned_to_student_id IS NULL) in their own classroom
create policy "Students can submit class homework"
on public.task_assignments
for update
to authenticated
using (
  task_type = 'homework'
  and assigned_to_student_id is null
  and classroom_id in (select s.classroom_id from public.students s where s.auth_user_id = auth.uid())
)
with check (
  task_type = 'homework'
  and assigned_to_student_id is null
  and classroom_id in (select s.classroom_id from public.students s where s.auth_user_id = auth.uid())
);

-- Guard: non-privileged callers may only change their own submissions key and append replies
create or replace function public.guard_task_assignment_student_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  old_replies jsonb;
  new_replies jsonb;
begin
  -- Privileged callers (owner, staff, admin/director) bypass the guard
  if new.assigned_by = auth.uid() or public._staff_check(auth.uid()) or public.is_admin_or_director() then
    return new;
  end if;

  select s.id into sid from public.students s where s.auth_user_id = auth.uid() limit 1;
  if sid is null then
    raise exception 'ไม่มีสิทธิ์แก้ไขงานนี้';
  end if;

  -- Only submissions and replies may change (updated_at excluded: may be maintained by trigger)
  if (to_jsonb(old) - 'submissions' - 'replies' - 'updated_at')
     is distinct from (to_jsonb(new) - 'submissions' - 'replies' - 'updated_at') then
    raise exception 'นักเรียนแก้ไขได้เฉพาะการส่งงานของตนเองเท่านั้น';
  end if;

  -- Other students' submission entries must remain unchanged
  if coalesce(old.submissions, '{}'::jsonb) - sid::text
     is distinct from coalesce(new.submissions, '{}'::jsonb) - sid::text then
    raise exception 'นักเรียนแก้ไขได้เฉพาะการส่งงานของตนเองเท่านั้น';
  end if;

  -- Replies: append-only (existing replies must stay as an unchanged prefix)
  old_replies := coalesce(old.replies, '[]'::jsonb);
  new_replies := coalesce(new.replies, '[]'::jsonb);
  if jsonb_array_length(new_replies) < jsonb_array_length(old_replies)
     or (select coalesce(bool_and(new_replies -> i = old_replies -> i), true)
         from generate_series(0, jsonb_array_length(old_replies) - 1) as i) is not true then
    raise exception 'ไม่สามารถแก้ไขข้อความตอบกลับเดิมได้';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_task_assignment_student_update on public.task_assignments;
create trigger trg_guard_task_assignment_student_update
before update on public.task_assignments
for each row execute function public.guard_task_assignment_student_update();