create table if not exists public.asset_repairs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets(id) on delete cascade,
  school_id uuid,
  reported_by uuid,
  description text not null,
  status text default 'pending' check (status in ('pending','approved','in_progress','done','rejected')),
  qr_code text,
  created_at timestamptz default now()
);
alter table public.asset_repairs enable row level security;
drop policy if exists "school read repairs" on public.asset_repairs; create policy "school read repairs" on public.asset_repairs for select to authenticated using (true);
drop policy if exists "staff manage repairs" on public.asset_repairs; create policy "staff manage repairs" on public.asset_repairs for all to authenticated using (true) with check (true);
