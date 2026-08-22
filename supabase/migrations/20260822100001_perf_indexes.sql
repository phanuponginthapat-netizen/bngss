DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='face_scan_logs' AND column_name='school_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='face_scan_logs' AND column_name='scan_date') THEN
    EXECUTE 'create index if not exists idx_face_scan_logs_school_date on public.face_scan_logs(school_id, scan_date)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sdq_records' AND column_name='school_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sdq_records' AND column_name='academic_year') THEN
    EXECUTE 'create index if not exists idx_sdq_school_year on public.sdq_records(school_id, academic_year)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance' AND column_name='school_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance' AND column_name='attendance_date') THEN
    EXECUTE 'create index if not exists idx_attendance_school_date on public.attendance(school_id, attendance_date)';
  END IF;
END $$;
