
ALTER TABLE public.face_scan_logs
  ADD COLUMN IF NOT EXISTS entry_method TEXT NOT NULL DEFAULT 'face';
