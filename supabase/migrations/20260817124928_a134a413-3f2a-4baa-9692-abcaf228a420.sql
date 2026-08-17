do $$
declare r record;
begin
  for r in
    with pol as (
      select coalesce(qual,'')||' '||coalesce(with_check,'') t
      from pg_policies where schemaname in ('public','storage')
    ), f as (
      select p.oid, p.proname from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    )
    select distinct f.oid from f
    where exists (select 1 from pol where pol.t like '%'||f.proname||'(%')
  loop
    begin
      execute format('grant execute on function %s to anon', r.oid::regprocedure::text);
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;