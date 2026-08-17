-- WizMind / CCTV face event bridge (realtime)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('camera-events','camera-events', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.camera_face_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  camera_id text not null,
  camera_name text,
  source text not null default 'wizmind',
  event_type text not null default 'face_detected',
  snapshot_path text,
  confidence numeric,
  bbox jsonb,
  meta jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  matched_user_id uuid,
  matched_person_type text,
  matched_name text,
  match_distance numeric,
  attendance_id uuid
);
create index if not exists idx_cfe_camera_created on public.camera_face_events (camera_id, created_at desc);
create index if not exists idx_cfe_unprocessed on public.camera_face_events (created_at desc) where processed = false;

grant select, update on public.camera_face_events to authenticated;
grant all on public.camera_face_events to service_role;

alter table public.camera_face_events enable row level security;

drop policy if exists "cfe staff read" on public.camera_face_events;
create policy "cfe staff read" on public.camera_face_events
  for select to authenticated using (public.is_staff_user());

drop policy if exists "cfe staff update" on public.camera_face_events;
create policy "cfe staff update" on public.camera_face_events
  for update to authenticated using (public.is_staff_user()) with check (public.is_staff_user());

-- realtime
alter table public.camera_face_events replica identity full;
do $$ begin
  begin
    alter publication supabase_realtime add table public.camera_face_events;
  exception when duplicate_object then null; end;
end $$;

-- storage policies: staff can read snapshots; writes only via service role (edge function)
drop policy if exists "camera events staff read" on storage.objects;
create policy "camera events staff read" on storage.objects
  for select to authenticated
  using (bucket_id = 'camera-events' and public.is_staff_user());

-- retention helper: ลบ event เก่ากว่า 7 วัน
create or replace function public.purge_camera_face_events(_days int default 7)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; begin
  delete from public.camera_face_events where created_at < now() - make_interval(days => _days);
  get diagnostics n = row_count; return n; end $$;
revoke all on function public.purge_camera_face_events(int) from public, anon;
grant execute on function public.purge_camera_face_events(int) to service_role;
