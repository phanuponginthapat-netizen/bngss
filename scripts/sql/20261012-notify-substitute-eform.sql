CREATE OR REPLACE FUNCTION public.notify_on_substitute_teaching()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid; subj text; room text; msg text;
BEGIN
  IF NEW.substitute_teacher IS NULL OR btrim(NEW.substitute_teacher) = '' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.substitute_teacher IS NOT DISTINCT FROM NEW.substitute_teacher THEN RETURN NEW; END IF;
  SELECT p.user_id INTO uid FROM public.personnel p
  WHERE p.user_id IS NOT NULL
    AND regexp_replace(btrim(coalesce(p.prefix,'')||coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),'\s+',' ','g')
        = regexp_replace(btrim(NEW.substitute_teacher),'\s+',' ','g')
  LIMIT 1;
  IF uid IS NULL THEN
    SELECT p.user_id INTO uid FROM public.personnel p
    WHERE p.user_id IS NOT NULL AND NEW.substitute_teacher ILIKE '%'||p.first_name||'%'||p.last_name||'%' LIMIT 1;
  END IF;
  IF uid IS NULL THEN RETURN NEW; END IF;
  SELECT name_th INTO subj FROM public.subjects WHERE id = NEW.subject_id;
  SELECT name INTO room FROM public.classrooms WHERE id = NEW.classroom_id;
  msg := 'สอนแทน '||coalesce(NEW.original_teacher,'-')||' วันที่ '||NEW.teaching_date
      ||coalesce(' คาบ '||NEW.period,'')||coalesce(' วิชา '||subj,'')||coalesce(' ห้อง '||room,'');
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id=uid AND reference_type='substitute_teaching' AND reference_id=NEW.id) THEN
    INSERT INTO public.notifications (user_id,title,message,type,reference_type,reference_id)
    VALUES (uid,'📚 มีงานสอนแทน',msg,'substitute','substitute_teaching',NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_substitute ON public.substitute_teaching;
CREATE TRIGGER trg_notify_substitute AFTER INSERT OR UPDATE OF substitute_teacher
ON public.substitute_teaching FOR EACH ROW EXECUTE FUNCTION public.notify_on_substitute_teaching();

CREATE OR REPLACE FUNCTION public.notify_on_eform_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE e record;
BEGIN
  IF NEW.recipient_id IS NULL THEN RETURN NEW; END IF;
  SELECT title, sender_name, sender_id, urgency INTO e FROM public.eforms WHERE id = NEW.eform_id;
  IF e.sender_id = NEW.recipient_id THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id=NEW.recipient_id AND reference_type='eform' AND reference_id=NEW.eform_id) THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id,title,message,type,reference_type,reference_id)
  VALUES (NEW.recipient_id,
    CASE WHEN e.urgency IN ('urgent','very_urgent','most_urgent') THEN '🔴 e-Form ด่วน: ' ELSE '📝 e-Form ใหม่: ' END||coalesce(e.title,'-'),
    'จาก '||coalesce(e.sender_name,'-')||' รอให้คุณดำเนินการ','eform','eform',NEW.eform_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_eform_recipient ON public.eform_recipients;
CREATE TRIGGER trg_notify_eform_recipient AFTER INSERT
ON public.eform_recipients FOR EACH ROW EXECUTE FUNCTION public.notify_on_eform_recipient();
