DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'observer'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'observer';
  END IF;
END$$;