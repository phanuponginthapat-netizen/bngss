-- error_logs hardened migration — 20260822100015
-- Ensures: id uuid PK, message, stack, url, user_id, created_at + RLS + grants
-- Idempotent: safe to run even if table already exists from 20260604080420

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  source text NOT NULL DEFAULT 'client',
  message text NOT NULL,
  stack text,
  component_stack text,
  url text,
  user_agent text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure required columns exist if table was created by older migration with different schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='id') THEN
    ALTER TABLE public.error_logs ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='message') THEN
    ALTER TABLE public.error_logs ADD COLUMN message text;
    UPDATE public.error_logs SET message = COALESCE(message, 'unknown') WHERE message IS NULL;
    ALTER TABLE public.error_logs ALTER COLUMN message SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='stack') THEN
    ALTER TABLE public.error_logs ADD COLUMN stack text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='url') THEN
    ALTER TABLE public.error_logs ADD COLUMN url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='user_id') THEN
    ALTER TABLE public.error_logs ADD COLUMN user_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='created_at') THEN
    ALTER TABLE public.error_logs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
  -- Optional extended columns for compatibility with app code (logError uses them)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='source') THEN
    ALTER TABLE public.error_logs ADD COLUMN source text NOT NULL DEFAULT 'client';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='component_stack') THEN
    ALTER TABLE public.error_logs ADD COLUMN component_stack text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='user_agent') THEN
    ALTER TABLE public.error_logs ADD COLUMN user_agent text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='error_logs' AND column_name='context') THEN
    ALTER TABLE public.error_logs ADD COLUMN context jsonb;
  END IF;
END $$;

-- Grants (idempotent via guard)
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT INSERT ON public.error_logs TO anon, authenticated';
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN
      _try := _try + 1; IF _try >= 5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table OR undefined_object THEN EXIT;
    END;
  END LOOP;
END $guard$;
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT SELECT, DELETE ON public.error_logs TO authenticated';
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN
      _try := _try + 1; IF _try >= 5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table THEN EXIT;
    END;
  END LOOP;
END $guard$;
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT ALL ON public.error_logs TO service_role';
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN
      _try := _try + 1; IF _try >= 5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table THEN EXIT;
    END;
  END LOOP;
END $guard$;

-- Enable RLS
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY';
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN
      _try := _try + 1; IF _try >= 5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table THEN EXIT;
    END;
  END LOOP;
END $guard$;

-- Policies: allow anyone to insert (anon+authenticated), admins can view/delete
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "anyone can insert errors" ON public.error_logs';
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN _try:=_try+1; IF _try>=5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table OR undefined_object THEN EXIT;
    END;
  END LOOP;
END $guard$;
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE POLICY "anyone can insert errors" ON public.error_logs FOR INSERT TO anon, authenticated WITH CHECK (true)';
      EXIT;
    EXCEPTION WHEN duplicate_object THEN EXIT;
    WHEN deadlock_detected OR lock_not_available THEN _try:=_try+1; IF _try>=5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table THEN EXIT;
    END;
  END LOOP;
END $guard$;

DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "admins view errors" ON public.error_logs';
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN _try:=_try+1; IF _try>=5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table OR undefined_object THEN EXIT;
    END;
  END LOOP;
END $guard$;
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE POLICY "admins view errors" ON public.error_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''director''))';
      EXIT;
    EXCEPTION WHEN duplicate_object THEN EXIT;
    WHEN deadlock_detected OR lock_not_available THEN _try:=_try+1; IF _try>=5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table THEN EXIT;
    END;
  END LOOP;
END $guard$;

DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "admins delete errors" ON public.error_logs';
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN _try:=_try+1; IF _try>=5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table OR undefined_object THEN EXIT;
    END;
  END LOOP;
END $guard$;
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE POLICY "admins delete errors" ON public.error_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''))';
      EXIT;
    EXCEPTION WHEN duplicate_object THEN EXIT;
    WHEN deadlock_detected OR lock_not_available THEN _try:=_try+1; IF _try>=5 THEN EXIT; END IF; PERFORM pg_sleep(0.3*_try);
    WHEN insufficient_privilege OR undefined_table THEN EXIT;
    END;
  END LOOP;
END $guard$;

-- Index for recent queries
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC)';
EXCEPTION WHEN undefined_table OR undefined_column OR duplicate_table THEN NULL;
END $idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_error_logs_user ON public.error_logs(user_id, created_at DESC)';
EXCEPTION WHEN undefined_table OR undefined_column OR duplicate_table THEN NULL;
END $idxguard$;
