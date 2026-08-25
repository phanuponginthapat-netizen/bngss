-- AR Learning (QR -> image/video/3D)
create table if not exists public.ar_experiences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  code text not null unique,
  title text not null,
  description text,
  media_type text not null default 'image' check (media_type in ('image','video','model3d','youtube')),
  media_url text not null,
  poster_url text,
  subject text,
  grade_level text,
  tags text[] default '{}',
  is_public boolean not null default true,
  is_active boolean not null default true,
  view_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.ar_experiences to anon;
grant select, insert, update, delete on public.ar_experiences to authenticated;
grant all on public.ar_experiences to service_role;

alter table public.ar_experiences enable row level security;

drop policy if exists "ar public read" on public.ar_experiences;
create policy "ar public read" on public.ar_experiences
  for select to anon, authenticated using (is_public and is_active);

drop policy if exists "ar staff read" on public.ar_experiences;
create policy "ar staff read" on public.ar_experiences
  for select to authenticated using (public.is_staff_any(auth.uid()));

drop policy if exists "ar staff insert" on public.ar_experiences;
create policy "ar staff insert" on public.ar_experiences
  for insert to authenticated with check (public.is_staff_any(auth.uid()));

drop policy if exists "ar staff update" on public.ar_experiences;
create policy "ar staff update" on public.ar_experiences
  for update to authenticated using (public.is_staff_any(auth.uid())) with check (public.is_staff_any(auth.uid()));

drop policy if exists "ar staff delete" on public.ar_experiences;
create policy "ar staff delete" on public.ar_experiences
  for delete to authenticated using (public.is_staff_any(auth.uid()));

create index if not exists ar_experiences_code_idx on public.ar_experiences(code);
create index if not exists ar_experiences_public_idx on public.ar_experiences(is_public, is_active);

-- auto school_id + updated_at
create or replace function public.ar_experiences_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.school_id is null then
    begin new.school_id := public.current_school_id(); exception when others then null; end;
  end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_ar_experiences_defaults on public.ar_experiences;
create trigger trg_ar_experiences_defaults before insert or update on public.ar_experiences
for each row execute function public.ar_experiences_defaults();

-- Public reader (works even for anon without exposing internals)
create or replace function public.get_public_ar_experience(_code text)
returns table(id uuid, code text, title text, description text, media_type text,
              media_url text, poster_url text, subject text, grade_level text,
              tags text[], view_count integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.code, a.title, a.description, a.media_type, a.media_url, a.poster_url,
         a.subject, a.grade_level, a.tags, a.view_count, a.created_at
  from public.ar_experiences a
  where a.code = _code and a.is_public and a.is_active
  limit 1
$$;

create or replace function public.list_public_ar_experiences(_limit integer default 60)
returns table(id uuid, code text, title text, description text, media_type text,
              media_url text, poster_url text, subject text, grade_level text,
              tags text[], view_count integer)
language sql stable security definer set search_path = public as $$
  select a.id, a.code, a.title, a.description, a.media_type, a.media_url, a.poster_url,
         a.subject, a.grade_level, a.tags, a.view_count
  from public.ar_experiences a
  where a.is_public and a.is_active
  order by a.created_at desc
  limit greatest(1, least(coalesce(_limit,60), 200))
$$;

create or replace function public.bump_ar_view(_code text)
returns void language sql volatile security definer set search_path = public as $$
  update public.ar_experiences set view_count = view_count + 1
  where code = _code and is_public and is_active
$$;

grant execute on function public.get_public_ar_experience(text) to anon, authenticated;
grant execute on function public.list_public_ar_experiences(integer) to anon, authenticated;
grant execute on function public.bump_ar_view(text) to anon, authenticated;

-- storage bucket
insert into storage.buckets (id, name, public) values ('ar-media','ar-media', true)
on conflict (id) do update set public = true;

drop policy if exists "ar media public read" on storage.objects;
create policy "ar media public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'ar-media');

drop policy if exists "ar media staff write" on storage.objects;
create policy "ar media staff write" on storage.objects
  for insert to authenticated with check (bucket_id = 'ar-media' and public.is_staff_any(auth.uid()));

drop policy if exists "ar media staff update" on storage.objects;
create policy "ar media staff update" on storage.objects
  for update to authenticated using (bucket_id = 'ar-media' and public.is_staff_any(auth.uid()));

drop policy if exists "ar media staff delete" on storage.objects;
create policy "ar media staff delete" on storage.objects
  for delete to authenticated using (bucket_id = 'ar-media' and public.is_staff_any(auth.uid()));
