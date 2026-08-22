-- Per-user private/public eForm templates
alter table public.eform_templates add column if not exists visibility text not null default 'private' check (visibility in ('private','public'));
alter table public.eform_templates add column if not exists is_public boolean generated always as (visibility='public') stored;

create index if not exists idx_eform_templates_visibility on public.eform_templates(visibility);
create index if not exists idx_eform_templates_created_by on public.eform_templates(created_by);

-- Update RLS: same-school read only public + own private
drop policy if exists "Same-school members read active templates" on public.eform_templates;
create policy "Same-school members read active templates"
  on public.eform_templates for select to authenticated
  using (
    is_active = true
    and (school_id is null or school_id = public.get_user_school_id(auth.uid()))
    and (visibility='public' or created_by = auth.uid() or public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'director'::app_role))
  );

comment on column public.eform_templates.visibility is 'private=เจ้าของเท่านั้น, public=แชร์ให้บุคลากรทั้งโรงเรียน';
