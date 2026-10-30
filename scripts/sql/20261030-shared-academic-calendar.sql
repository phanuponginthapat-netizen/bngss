-- Apply only to the school backend. No historical results are changed.
BEGIN;
CREATE OR REPLACE FUNCTION public.resolve_school_term(_date date)
RETURNS TABLE(academic_year_be integer, semester smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH candidate AS (
  SELECT ap.* FROM public.academic_periods ap
  WHERE _date BETWEEN ap.start_date AND ap.end_date OR (ap.end_date<_date AND ap.end_date>=_date-180)
  ORDER BY (_date BETWEEN ap.start_date AND ap.end_date) DESC,
   CASE WHEN _date BETWEEN ap.start_date AND ap.end_date THEN ap.start_date ELSE ap.end_date END DESC LIMIT 1
 ), settings AS (
  SELECT max(setting_value) FILTER(WHERE setting_key='academic_year_override') yr,
   max(setting_value) FILTER(WHERE setting_key='semester_override') sem FROM public.school_settings
 )
 SELECT CASE WHEN s.yr ~ '^[0-9]{4}$' AND s.yr::int>2000 THEN s.yr::int ELSE c.academic_year_be END,
  CASE WHEN s.sem IN ('1','2') THEN s.sem::smallint ELSE c.semester END
 FROM settings s LEFT JOIN candidate c ON true
 WHERE c.academic_year_be IS NOT NULL OR (s.yr ~ '^[0-9]{4}$' AND s.sem IN('1','2'));
$$;
REVOKE ALL ON FUNCTION public.resolve_school_term(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_school_term(date) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.sync_current_academic_period()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 SELECT ap.id INTO v_id FROM public.academic_periods ap
 JOIN public.resolve_school_term((now() AT TIME ZONE 'Asia/Bangkok')::date) r USING(academic_year_be,semester);
 IF v_id IS NULL THEN RETURN 'no-period'; END IF;
 UPDATE public.academic_periods SET is_current=false WHERE id<>v_id AND is_current=true;
 UPDATE public.academic_periods SET is_current=true WHERE id=v_id AND is_current IS DISTINCT FROM true;
 RETURN 'synchronized';
END; $$;
REVOKE ALL ON FUNCTION public.sync_current_academic_period() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_current_academic_period() TO service_role;

CREATE OR REPLACE FUNCTION public.save_academic_period_dates(_year_be integer,_terms jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record; v_start date; v_end date;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF _year_be IS NULL OR _year_be NOT BETWEEN 2400 AND 3000 OR _terms IS NULL OR jsonb_typeof(_terms)<>'array' THEN RAISE EXCEPTION 'invalid input'; END IF;
 IF jsonb_array_length(_terms)<>2 THEN RAISE EXCEPTION 'both semesters required'; END IF;
 PERFORM pg_advisory_xact_lock(6103015);
 IF (SELECT count(DISTINCT semester) FROM jsonb_to_recordset(_terms) AS x(semester int) WHERE semester IN(1,2))<>2 THEN RAISE EXCEPTION 'both semesters required'; END IF;
 FOR t IN SELECT * FROM jsonb_to_recordset(_terms) AS x(semester int,start_date date,end_date date) LOOP
  IF t.start_date IS NULL OR t.end_date IS NULL OR t.start_date>t.end_date THEN RAISE EXCEPTION 'invalid dates'; END IF;
  IF EXISTS(SELECT 1 FROM public.academic_periods ap WHERE ap.academic_year_be<>_year_be AND ap.start_date<=t.end_date AND ap.end_date>=t.start_date) THEN RAISE EXCEPTION 'overlapping years'; END IF;
 END LOOP;
 SELECT end_date INTO v_end FROM jsonb_to_recordset(_terms) AS x(semester int,end_date date) WHERE semester=1;
 SELECT start_date INTO v_start FROM jsonb_to_recordset(_terms) AS x(semester int,start_date date) WHERE semester=2;
 IF v_end>=v_start THEN RAISE EXCEPTION 'overlapping semesters'; END IF;
 INSERT INTO public.academic_periods(academic_year_be,semester,start_date,end_date)
 SELECT _year_be,semester,start_date,end_date FROM jsonb_to_recordset(_terms) AS x(semester smallint,start_date date,end_date date)
 ON CONFLICT(academic_year_be,semester) DO UPDATE SET start_date=excluded.start_date,end_date=excluded.end_date;
 PERFORM public.sync_current_academic_period();
END; $$;
REVOKE ALL ON FUNCTION public.save_academic_period_dates(integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_academic_period_dates(integer,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.calendar_sync_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.sync_current_academic_period(); RETURN NULL; END; $$;
REVOKE ALL ON FUNCTION public.calendar_sync_after_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS academic_dates_sync ON public.academic_periods;
CREATE TRIGGER academic_dates_sync AFTER INSERT OR UPDATE OF start_date,end_date ON public.academic_periods FOR EACH STATEMENT EXECUTE FUNCTION public.calendar_sync_after_change();
DROP TRIGGER IF EXISTS academic_override_sync ON public.school_settings;
CREATE TRIGGER academic_override_sync AFTER INSERT OR UPDATE ON public.school_settings FOR EACH ROW
 WHEN(NEW.setting_key IN('academic_year_override','semester_override')) EXECUTE FUNCTION public.calendar_sync_after_change();

-- Derive NEW attendance from its actual date, rather than a month guess.
CREATE OR REPLACE FUNCTION public.attendance_shared_term()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 SELECT * INTO r FROM public.resolve_school_term(NEW.attendance_date);
 IF r.academic_year_be IS NOT NULL AND (NEW.academic_year IS NULL OR NEW.semester IS NULL) THEN
  NEW.academic_year:=COALESCE(NEW.academic_year,r.academic_year_be-543);
  NEW.semester:=COALESCE(NEW.semester,r.semester);
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.attendance_shared_term() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS attendance_shared_term ON public.attendance;
CREATE TRIGGER attendance_shared_term BEFORE INSERT ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.attendance_shared_term();

CREATE OR REPLACE FUNCTION public.auto_set_current_period()
RETURNS TABLE(academic_year_be integer,semester smallint) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 PERFORM public.sync_current_academic_period();
 RETURN QUERY SELECT ap.academic_year_be,ap.semester FROM public.academic_periods ap WHERE ap.is_current;
END; $$;
SELECT public.sync_current_academic_period();
COMMIT;