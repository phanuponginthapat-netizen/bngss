create or replace function public.self_enroll_personnel_face(_samples jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _pid uuid;
  _next int;
  _s jsonb;
  _n int := 0;
begin
  select id into _pid from public.personnel where user_id = auth.uid() limit 1;
  if _pid is null then
    raise exception 'ไม่พบข้อมูลบุคลากรของบัญชีนี้';
  end if;
  if _samples is null or jsonb_array_length(_samples) = 0 then
    raise exception 'ไม่มีตัวอย่างใบหน้า';
  end if;

  select coalesce(max(sample_index)+1, 0) into _next
  from public.personnel_face_descriptors where personnel_id = _pid;

  for _s in select * from jsonb_array_elements(_samples) loop
    insert into public.personnel_face_descriptors
      (personnel_id, sample_index, descriptor, quality_score, face_image, metrics, captured_by, source)
    values (
      _pid, _next,
      array(select (jsonb_array_elements_text(_s->'descriptor'))::real),
      nullif(_s->>'quality_score','')::real,
      _s->>'face_image',
      coalesce(_s->'metrics', '{}'::jsonb),
      auth.uid(),
      'self_enroll_personnel'
    );
    _next := _next + 1;
    _n := _n + 1;
  end loop;

  return _n;
end;
$$;

grant execute on function public.self_enroll_personnel_face(jsonb) to authenticated;