-- รถรับส่ง GPS
create table if not exists public.bus_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  name text not null,
  driver_id uuid,
  created_at timestamptz default now()
);
create table if not exists public.bus_attendance (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.bus_routes(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  boarded_at timestamptz default now(),
  status text default 'boarded'
);
-- ห้องสมุด
create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  title text not null,
  barcode text unique,
  created_at timestamptz default now()
);
create table if not exists public.library_loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.library_books(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  borrowed_at timestamptz default now(),
  due_at timestamptz,
  returned_at timestamptz,
  status text default 'borrowed'
);
-- วPA
create table if not exists public.wpa_assessments (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid references public.personnel(id) on delete cascade,
  period text,
  score numeric,
  status text default 'draft',
  created_at timestamptz default now()
);
alter table public.bus_routes enable row level security;
alter table public.bus_attendance enable row level security;
alter table public.library_books enable row level security;
alter table public.library_loans enable row level security;
alter table public.wpa_assessments enable row level security;
drop policy if exists "auth read bus" on public.bus_routes; create policy "auth read bus" on public.bus_routes for all to authenticated using (true) with check (true);
drop policy if exists "auth all bus_att" on public.bus_attendance; create policy "auth all bus_att" on public.bus_attendance for all to authenticated using (true) with check (true);
drop policy if exists "auth all lib books" on public.library_books; create policy "auth all lib books" on public.library_books for all to authenticated using (true) with check (true);
drop policy if exists "auth all lib loans" on public.library_loans; create policy "auth all lib loans" on public.library_loans for all to authenticated using (true) with check (true);
drop policy if exists "auth all wpa" on public.wpa_assessments; create policy "auth all wpa" on public.wpa_assessments for all to authenticated using (true) with check (true);
