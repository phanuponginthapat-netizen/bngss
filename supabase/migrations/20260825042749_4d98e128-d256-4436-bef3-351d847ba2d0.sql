alter table public.ar_projects add column if not exists targets_url text;
alter table public.ar_projects add column if not exists targets_version integer not null default 0;

alter table public.ar_experiences add column if not exists marker_image_url text;
alter table public.ar_experiences add column if not exists target_index integer;
alter table public.ar_experiences add column if not exists overlay_width numeric not null default 1;
alter table public.ar_experiences add column if not exists overlay_height numeric not null default 0.5625;
alter table public.ar_experiences add column if not exists autoplay boolean not null default true;
alter table public.ar_experiences add column if not exists loop_media boolean not null default true;
alter table public.ar_experiences add column if not exists muted boolean not null default true;

drop function if exists public.get_public_ar_project(text);
create function public.get_public_ar_project(_slug text)
returns table(id uuid, slug text, title text, description text, cover_url text,
              location text, targets_url text, targets_version integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.title, p.description, p.cover_url, p.location,
         p.targets_url, p.targets_version, p.created_at
  from public.ar_projects p
  where p.slug = _slug and p.is_public and p.is_active
  limit 1
$$;

drop function if exists public.list_public_ar_project_items(text);
create function public.list_public_ar_project_items(_slug text)
returns table(id uuid, code text, title text, marker_label text, description text,
              media_type text, media_url text, poster_url text, sort_order integer,
              view_count integer, marker_image_url text, target_index integer,
              overlay_width numeric, overlay_height numeric,
              autoplay boolean, loop_media boolean, muted boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.code, a.title, a.marker_label, a.description, a.media_type,
         a.media_url, a.poster_url, a.sort_order, a.view_count,
         a.marker_image_url, a.target_index, a.overlay_width, a.overlay_height,
         a.autoplay, a.loop_media, a.muted
  from public.ar_experiences a
  join public.ar_projects p on p.id = a.project_id
  where p.slug = _slug and p.is_public and p.is_active
    and a.is_public and a.is_active
  order by coalesce(a.target_index, a.sort_order), a.sort_order, a.created_at
$$;

grant execute on function public.get_public_ar_project(text) to anon, authenticated;
grant execute on function public.list_public_ar_project_items(text) to anon, authenticated;