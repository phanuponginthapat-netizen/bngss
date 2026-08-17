-- ปรับสิทธิ์โมดูลพัสดุ/ครุภัณฑ์/จัดซื้อจัดจ้าง ให้ตรงกับข้อกำหนดของ UI
-- UI เปิดให้ admin/director + ฝ่าย finance_personnel แต่ RLS เดิมเช็คเฉพาะฝ่าย budget_planning
-- ทำให้ผู้ดูแลระบบ/ผอ. เห็นหน้าจอ แต่ดึงข้อมูลไม่ได้ (จอว่าง / บันทึกไม่ได้)

create or replace function public.can_manage_assets(_user_id uuid, _min public.dept_position default 'member')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'admin'::public.app_role)
    or public.has_role(_user_id, 'director'::public.app_role)
    or public.has_dept_position(_user_id, 'finance_personnel'::public.school_department, _min)
    or public.has_dept_position(_user_id, 'budget_planning'::public.school_department, _min)
$$;

revoke all on function public.can_manage_assets(uuid, public.dept_position) from public;
grant execute on function public.can_manage_assets(uuid, public.dept_position) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['assets','procurement_records','asset_damage_reports'] loop
    execute format('drop policy if exists dept_member_view on public.%I', t);
    execute format('drop policy if exists dept_member_insert on public.%I', t);
    execute format('drop policy if exists dept_member_update on public.%I', t);
    execute format('drop policy if exists dept_head_delete on public.%I', t);

    execute format($f$create policy dept_member_view on public.%I for select to authenticated
      using (public.can_manage_assets(auth.uid(), 'member'))$f$, t);
    execute format($f$create policy dept_member_insert on public.%I for insert to authenticated
      with check (public.can_manage_assets(auth.uid(), 'member'))$f$, t);
    execute format($f$create policy dept_member_update on public.%I for update to authenticated
      using (public.can_manage_assets(auth.uid(), 'member'))
      with check (public.can_manage_assets(auth.uid(), 'member'))$f$, t);
    execute format($f$create policy dept_head_delete on public.%I for delete to authenticated
      using (public.can_manage_assets(auth.uid(), 'head'))$f$, t);
  end loop;
end $$;

grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, update, delete on public.procurement_records to authenticated;
grant select, insert, update, delete on public.asset_damage_reports to authenticated;
