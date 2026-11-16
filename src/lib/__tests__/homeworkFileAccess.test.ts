// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('lets school staff read homework without exposing files to other students or anonymous users', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.uid',true)::uuid $$;
      CREATE TABLE public.user_roles(user_id uuid,role text);
      CREATE FUNCTION public._staff_check(uid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
        SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role IN ('teacher','director','admin'))
      $$;
      CREATE TABLE storage.objects(bucket_id text,name text,owner uuid);
      GRANT USAGE ON SCHEMA storage,auth TO authenticated,anon;
      GRANT SELECT ON storage.objects TO authenticated,anon;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='homework-files' AND owner=auth.uid());
      INSERT INTO storage.objects VALUES('homework-files','student.jpg','11111111-1111-1111-1111-111111111111'),('private-other','private.jpg','11111111-1111-1111-1111-111111111111');
      INSERT INTO public.user_roles VALUES('22222222-2222-2222-2222-222222222222','teacher');
      SET test.uid='22222222-2222-2222-2222-222222222222';
    `);
    await db.exec(readFileSync('drizzle/migrations/0057_homework_staff_file_read.sql','utf8'));
    await db.exec('SET ROLE authenticated');
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([{name:'student.jpg'}]);
    await db.exec(`SET test.uid='33333333-3333-3333-3333-333333333333'`);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([]);
    await db.exec(`SET test.uid='11111111-1111-1111-1111-111111111111'`);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([{name:'student.jpg'}]);
    await db.exec('RESET ROLE; SET ROLE anon');
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([]);
  } finally { await db.close(); }
},30000);