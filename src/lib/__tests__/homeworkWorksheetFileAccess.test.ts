// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';

const db = new PGlite();
const uid = '11111111-1111-1111-1111-111111111111';
const school = '22222222-2222-2222-2222-222222222222';
const classroom = '33333333-3333-3333-3333-333333333333';
const other = '44444444-4444-4444-4444-444444444444';
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE public.students(auth_user_id uuid,school_id uuid,classroom_id uuid);
    CREATE TABLE public.homework_assignments(pdf_path text,school_id uuid,classroom_id uuid);
    CREATE TABLE storage.objects(bucket_id text,name text);
    GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;
    GRANT SELECT ON public.students,public.homework_assignments,storage.objects TO authenticated,anon;
    ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_student ON public.students FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    INSERT INTO public.students VALUES('${uid}','${school}','${classroom}');
    INSERT INTO public.homework_assignments VALUES
      ('assigned.pdf','${school}','${classroom}'),('school.pdf','${school}',NULL),
      ('other-class.pdf','${school}','${other}'),('other-school.pdf','${other}',NULL),
      ('null-school.pdf',NULL,'${classroom}');
    INSERT INTO storage.objects VALUES
      ('homework-files','assigned.pdf'),('homework-files','school.pdf'),
      ('homework-files','other-class.pdf'),('homework-files','other-school.pdf'),
      ('homework-files','unassigned.pdf'),('homework-files','another-student-answer.pdf'),
      ('homework-files','null-school.pdf'),('other-bucket','assigned.pdf');
    SET test.uid='${uid}';
  `);
  await db.exec(readFileSync('drizzle/migrations/0074_homework_assigned_student_pdf_read.sql','utf8'));
  await db.exec('SET ROLE authenticated');
},30000);
afterAll(async () => { await db.close(); });
const visible = async (name: string, bucket = 'homework-files') =>
  (await db.query('SELECT name FROM storage.objects WHERE name=$1 AND bucket_id=$2',[name,bucket])).rows;
it('allows the exact PDF assigned to the authenticated student classroom',async () => {
  expect(await visible('assigned.pdf')).toEqual([{name:'assigned.pdf'}]);
});
it('allows school-wide worksheets only for the same school',async () => {
  expect(await visible('school.pdf')).toEqual([{name:'school.pdf'}]);
  expect(await visible('other-school.pdf')).toEqual([]);
});
it('denies worksheets for another classroom',async () => {
  expect(await visible('other-class.pdf')).toEqual([]);
});
it('denies unassigned files and other students answer files',async () => {
  expect(await visible('unassigned.pdf')).toEqual([]);
  expect(await visible('another-student-answer.pdf')).toEqual([]);
});
it('never grants another bucket through a matching filename',async () => {
  expect(await visible('assigned.pdf','other-bucket')).toEqual([]);
});
it('preserves legacy null-school assignments within the exact classroom',async () => {
  expect(await visible('null-school.pdf')).toEqual([{name:'null-school.pdf'}]);
});
it('denies an account without a linked student and anonymous callers',async () => {
  await db.exec(`SET test.uid='${other}'`);
  expect(await visible('assigned.pdf')).toEqual([]);
  await db.exec(`SET test.uid='${uid}'; RESET ROLE; SET ROLE anon`);
  expect(await visible('assigned.pdf')).toEqual([]);
  await db.exec('RESET ROLE; SET ROLE authenticated');
});