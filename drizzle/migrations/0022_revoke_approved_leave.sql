ALTER TABLE public.staff_leaves
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid,
  ADD COLUMN IF NOT EXISTS revoke_reason text;
COMMENT ON COLUMN public.staff_leaves.revoked_at IS 'ขอยกเลิกวันลาที่อนุมัติแล้ว (มาปฏิบัติหน้าที่) — status ยังคง approved เพื่อเก็บประวัติการอนุมัติ';

CREATE OR REPLACE FUNCTION public.release_substitutes_on_leave_revoke()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    IF NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'ขอยกเลิกวันลาได้เฉพาะใบลาที่อนุมัติแล้ว';
    END IF;
    IF NEW.revoked_by IS NULL THEN NEW.revoked_by := auth.uid(); END IF;
    UPDATE public.substitute_teaching
       SET status = 'released',
           notes = trim(both ' ' from coalesce(notes,'') || ' [พ้นหน้าที่สอนแทน: เจ้าของคาบมาปฏิบัติหน้าที่ '
                   || to_char(NEW.revoked_at AT TIME ZONE 'Asia/Bangkok','DD/MM/YYYY HH24:MI') || ']')
     WHERE leave_id = NEW.id AND status <> 'completed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_release_substitutes_on_leave_revoke ON public.staff_leaves;
CREATE TRIGGER trg_release_substitutes_on_leave_revoke
  BEFORE UPDATE OF revoked_at ON public.staff_leaves
  FOR EACH ROW EXECUTE FUNCTION public.release_substitutes_on_leave_revoke();

CREATE OR REPLACE FUNCTION public.update_leave_used_days()
RETURNS trigger AS $$
BEGIN
  UPDATE public.leave_balances lb
  SET used_days = (
    SELECT COALESCE(SUM(sl.days_requested), 0)
    FROM public.staff_leaves sl
    WHERE sl.user_id = lb.user_id
      AND sl.status = 'approved'
      AND sl.revoked_at IS NULL
      AND sl.leave_type = lb.leave_type
      AND EXTRACT(YEAR FROM sl.start_date) = lb.year
  ),
  updated_at = now()
  WHERE lb.user_id = COALESCE(NEW.user_id, OLD.user_id)
    AND lb.year = EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date))::integer;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;