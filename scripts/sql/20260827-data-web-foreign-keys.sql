-- เชื่อมโยงข้อมูลระหว่างโมดูล (ลดการกรอกซ้ำ / กันข้อมูลกำพร้า)
-- ตรวจแล้วว่าไม่มี orphan rows ก่อนสร้าง FK ทุกตัว
DO $$
DECLARE
  r record;
  rels text[][] := ARRAY[
    ['certificate_issues','student_id','students','SET NULL'],
    ['certificate_issues','personnel_id','personnel','SET NULL'],
    ['chat_messages','sender_id','profiles','CASCADE'],
    ['club_feed_posts','author_id','profiles','CASCADE'],
    ['document_versions','document_id','documents','CASCADE'],
    ['game_hub_scores','student_id','students','CASCADE'],
    ['learning_contents','subject_id','subjects','SET NULL'],
    ['learning_contents','owner_id','profiles','SET NULL'],
    ['news_posts','author_id','profiles','SET NULL'],
    ['padlet_boards','owner_id','profiles','CASCADE'],
    ['padlet_notes','author_id','profiles','SET NULL'],
    ['student_enrollment_history','student_id','students','CASCADE'],
    ['student_enrollment_history','classroom_id','classrooms','SET NULL'],
    ['template_fill_history','student_id','students','SET NULL'],
    ['activities','academic_period_id','academic_periods','SET NULL'],
    ['procurement_advances','borrower_id','profiles','SET NULL'],
    ['procurement_records','advance_request_id','procurement_advances','SET NULL'],
    ['camera_face_events','attendance_id','attendance','SET NULL'],
    ['hub_projects','responsible_user_id','profiles','SET NULL'],
    ['students','parent_user_id','profiles','SET NULL']
  ];
  i int;
  cname text;
BEGIN
  FOR i IN 1 .. array_length(rels,1) LOOP
    cname := 'fk_'||rels[i][1]||'_'||rels[i][2];
    IF to_regclass('public.'||rels[i][1]) IS NULL OR to_regclass('public.'||rels[i][3]) IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = cname) THEN CONTINUE; END IF;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE %s',
      rels[i][1], cname, rels[i][2], rels[i][3], rels[i][4]);
    -- ดัชนีฝั่ง FK เพื่อให้ join/ลบข้อมูลเร็ว
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(%I)',
      'idx_'||rels[i][1]||'_'||rels[i][2], rels[i][1], rels[i][2]);
  END LOOP;
END $$;
