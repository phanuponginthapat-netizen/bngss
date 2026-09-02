-- Create cold storage registry table to track files offloaded from Supabase Storage to Google Drive
CREATE TABLE IF NOT EXISTS public.cold_storage_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_name text NOT NULL,
  file_path text NOT NULL,
  drive_file_id text NOT NULL,
  drive_web_link text,
  mime_type text,
  size_bytes bigint DEFAULT 0,
  offloaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_cold_storage_bucket_path UNIQUE (bucket_name, file_path)
);

CREATE INDEX IF NOT EXISTS idx_cold_storage_bucket ON public.cold_storage_registry (bucket_name);
CREATE INDEX IF NOT EXISTS idx_cold_storage_drive_id ON public.cold_storage_registry (drive_file_id);
CREATE INDEX IF NOT EXISTS idx_cold_storage_offloaded_at ON public.cold_storage_registry (offloaded_at DESC);

-- Enable RLS
ALTER TABLE public.cold_storage_registry ENABLE ROW LEVEL SECURITY;

-- Permissions
GRANT SELECT ON public.cold_storage_registry TO authenticated;
GRANT ALL ON public.cold_storage_registry TO service_role;

DROP POLICY IF EXISTS "cold_storage_authenticated_select" ON public.cold_storage_registry;
CREATE POLICY "cold_storage_authenticated_select"
  ON public.cold_storage_registry
  FOR SELECT
  TO authenticated
  USING (true);

-- Schedule weekly pg_cron offload if pg_cron & pg_net extensions are enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedue if previously existed to avoid duplicates
    PERFORM cron.unschedule('weekly-storage-offload') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-storage-offload');
    
    PERFORM cron.schedule(
      'weekly-storage-offload',
      '0 19 * * 6', -- Saturday 19:00 UTC = Sunday 02:00 ICT (Asia/Bangkok)
      $CRON$
      SELECT net.http_post(
        url := (SELECT COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL'),
          current_setting('app.settings.supabase_url', true)
        )) || '/functions/v1/storage-tier',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT COALESCE(
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'),
            current_setting('app.settings.service_role_key', true)
          ))
        ),
        body := '{"action": "offload"}'::jsonb
      );
      $CRON$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron setup skipped: %', SQLERRM;
END $$;
