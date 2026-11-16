// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { it, expect } from 'vitest';

it('returns only linked face identities and rejects student duplicate lookups', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '11111111-1111-1111-1111-111111111111'::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated'::text $$;
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE FUNCTION public.face_distance(real[],real[]) RETURNS real LANGUAGE sql AS $$ SELECT 0::real $$;
      CREATE TABLE profiles(id uuid,avatar_url text,student_code text,first_name text,last_name text);
      CREATE TABLE classrooms(id uuid,name text);
      CREATE TABLE students(id uuid,auth_user_id uuid,student_code text,prefix text,first_name text,last_name text,photo_url text,classroom_id uuid);
      CREATE TABLE personnel(id uuid,user_id uuid,employee_code text,prefix text,first_name text,last_name text);
      CREATE TABLE student_face_descriptors(student_id uuid,descriptor real[]);
      INSERT INTO profiles VALUES('11111111-1111-1111-1111-111111111111',NULL,'2777','Other','Student');
      INSERT INTO students VALUES('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','2777',NULL,'Other','Student',NULL,NULL);
    `);
    await db.exec(readFileSync('drizzle/migrations/0050_restrict_face_identity_access.sql','utf8'));
    expect((await db.query('SELECT * FROM public.get_my_face_identity()')).rows).toEqual([]);
    await db.exec(`UPDATE students SET auth_user_id='11111111-1111-1111-1111-111111111111'`);
    expect((await db.query('SELECT code FROM public.get_my_face_identity()')).rows).toEqual([{code:'2777'}]);
    await expect(db.query(`SELECT * FROM public.check_face_duplicate(NULL,'[]'::jsonb,0.42::real)`)).rejects.toThrow('Forbidden');
  } finally { await db.close(); }
},30000);