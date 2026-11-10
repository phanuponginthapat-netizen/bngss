CREATE OR REPLACE FUNCTION public.line_vault_dispatch(category text, payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.cron_invoke('notify-line-vault-groups', jsonb_build_object('category', category, 'payload', payload), 30000);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'line_vault_dispatch failed: %', SQLERRM;
END;
$$;