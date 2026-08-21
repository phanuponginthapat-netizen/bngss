-- Cron: ลบ push_subscriptions เก่าเกิน 90 วัน (กันบวม) + function helper
create or replace function public.cleanup_stale_push_subscriptions()
returns void language plpgsql security definer as $$
begin
  delete from public.push_subscriptions where updated_at < now() - interval '90 days';
end $$;

-- pg_cron job (ถ้าเปิด extension pg_cron)
do $$ begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('cleanup-push-subscriptions','0 3 * * *','select public.cleanup_stale_push_subscriptions();');
  end if;
end $$;
