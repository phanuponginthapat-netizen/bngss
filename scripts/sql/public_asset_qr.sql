-- Public asset QR lookup + "found asset" reporting (anon-safe, no direct table access)

create or replace function public.get_public_asset(_id uuid)
returns table (
  id uuid,
  asset_code text,
  asset_name text,
  category text,
  condition text,
  status text,
  location text,
  building text,
  room text,
  floor text,
  serial_number text,
  acquisition_date date,
  useful_life_years integer,
  photo_url text,
  photos jsonb,
  latitude numeric,
  longitude numeric,
  responsible_person text,
  responsible_user_id uuid,
  school_id uuid,
  school_name text,
  school_phone text,
  school_email text,
  school_address text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id, a.asset_code, a.asset_name, a.category, a.condition, a.status,
    a.location, a.building, a.room, a.floor, a.serial_number,
    a.acquisition_date, a.useful_life_years, a.photo_url, a.photos,
    a.latitude, a.longitude, a.responsible_person, a.responsible_user_id,
    a.school_id, s.school_name, s.phone, s.email, s.address
  from public.assets a
  left join public.schools s on s.id = a.school_id
  where a.id = _id
$$;

revoke all on function public.get_public_asset(uuid) from public;
grant execute on function public.get_public_asset(uuid) to anon, authenticated;

create or replace function public.get_public_asset_contact(_asset_id uuid)
returns table (full_name text, position text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select
    trim(coalesce(p.prefix, '') || coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
    p.position,
    p.phone
  from public.assets a
  join public.personnel p on p.user_id = a.responsible_user_id
  where a.id = _asset_id
  limit 1
$$;

revoke all on function public.get_public_asset_contact(uuid) from public;
grant execute on function public.get_public_asset_contact(uuid) to anon, authenticated;

create or replace function public.report_found_asset(
  _asset_id uuid,
  _reporter_name text,
  _description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
  _recent integer;
begin
  if _asset_id is null or not exists (select 1 from public.assets where id = _asset_id) then
    raise exception 'ไม่พบทรัพย์สินนี้ในระบบ';
  end if;

  _reporter_name := nullif(btrim(coalesce(_reporter_name, '')), '');
  _description := nullif(btrim(coalesce(_description, '')), '');

  if _reporter_name is null or _description is null then
    raise exception 'กรุณากรอกชื่อผู้แจ้งและรายละเอียด';
  end if;

  if length(_reporter_name) > 120 then _reporter_name := left(_reporter_name, 120); end if;
  if length(_description) > 1000 then _description := left(_description, 1000); end if;

  -- basic anti-spam: max 5 reports per asset per hour
  select count(*) into _recent
  from public.asset_damage_reports
  where asset_id = _asset_id and created_at > now() - interval '1 hour';

  if _recent >= 5 then
    raise exception 'มีการแจ้งซ้ำหลายครั้งแล้ว กรุณาลองใหม่ภายหลัง';
  end if;

  insert into public.asset_damage_reports (asset_id, description, reporter_name, reported_by_user_id, status)
  values (_asset_id, _description, _reporter_name, auth.uid(), 'pending')
  returning id into _id;

  return _id;
end;
$$;

revoke all on function public.report_found_asset(uuid, text, text) from public;
grant execute on function public.report_found_asset(uuid, text, text) to anon, authenticated;
