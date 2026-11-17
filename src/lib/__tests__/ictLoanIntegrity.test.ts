// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('restores admin CRUD, protects loan history and rejects borrowing unavailable equipment', async () => {
 const db = new PGlite();
 try {
  await db.exec(`
   CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.uid',true)::uuid $$;
   CREATE TYPE ict_device_status AS ENUM('available','borrowed','maintenance','lost','retired');
   CREATE TABLE user_roles(user_id uuid,role text);
   CREATE FUNCTION has_role(uid uuid,r text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=uid AND role=r) $$;
   CREATE FUNCTION _staff_check(uid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=uid AND role IN('admin','director','teacher')) $$;
   CREATE TABLE students(id uuid,auth_user_id uuid); CREATE TABLE personnel(id uuid,user_id uuid);
   CREATE TABLE storage.objects(bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   GRANT USAGE ON SCHEMA storage TO authenticated; GRANT SELECT ON storage.objects TO authenticated;
   INSERT INTO storage.objects VALUES('ict-loan-photos','borrow/evidence.jpg'),('other-private','private.jpg');
   CREATE TABLE ict_devices(id uuid PRIMARY KEY,status ict_device_status);
   CREATE TABLE ict_loans(id uuid PRIMARY KEY,device_id uuid REFERENCES ict_devices ON DELETE CASCADE,student_id uuid,personnel_id uuid,status text,borrowed_at timestamptz DEFAULT now(),expected_return_at timestamptz);
   ALTER TABLE ict_devices ENABLE ROW LEVEL SECURITY; ALTER TABLE ict_loans ENABLE ROW LEVEL SECURITY;
   GRANT USAGE ON SCHEMA auth TO authenticated; GRANT SELECT ON students,personnel TO authenticated;
   INSERT INTO user_roles VALUES('11111111-1111-1111-1111-111111111111','admin'),('22222222-2222-2222-2222-222222222222','student');
   SET test.uid='11111111-1111-1111-1111-111111111111';
  `);
  await db.exec(readFileSync('drizzle/migrations/0059_ict_device_loan_integrity.sql','utf8'));
  await db.exec(readFileSync('drizzle/migrations/0060_ict_loan_evidence_staff_read.sql','utf8'));
  await db.exec(`SET ROLE authenticated; INSERT INTO ict_devices VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','available');`);
  expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([{name:'borrow/evidence.jpg'}]);
  expect((await db.query('SELECT * FROM ict_devices')).rows).toHaveLength(1);
  await expect(db.exec(`UPDATE ict_devices SET status='borrowed'`)).rejects.toThrow('รายการยืมจริง');
  await db.exec(`UPDATE ict_devices SET status='maintenance'`);
  const borrow = `INSERT INTO ict_loans(id,device_id,personnel_id,status) VALUES('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','active')`;
  await expect(db.exec(borrow)).rejects.toThrow('ไม่พร้อมยืม');
  await db.exec(`UPDATE ict_devices SET status='available'; ${borrow};`);
  await expect(db.exec(`DELETE FROM ict_devices`)).rejects.toThrow('ประวัติยืม');
  await expect(db.exec(`UPDATE ict_devices SET status='retired'`)).rejects.toThrow('ต้องคืน');
  await db.exec(`UPDATE ict_loans SET status='returned'; UPDATE ict_devices SET status='retired';`);
  await expect(db.exec(`DELETE FROM ict_devices`)).rejects.toThrow('ประวัติยืม');
  await db.exec(`SET test.uid='22222222-2222-2222-2222-222222222222';`);
  expect((await db.query('SELECT * FROM ict_loans')).rows).toHaveLength(0);
  expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([]);
  expect((await db.query('SELECT * FROM ict_devices')).rows).toHaveLength(1);
  await expect(db.exec(`INSERT INTO ict_devices VALUES('cccccccc-cccc-cccc-cccc-cccccccccccc','available')`)).rejects.toThrow();
 } finally { await db.close(); }
},30000);

it('allows admins to remove unused photos but preserves referenced loan evidence', async () => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA storage;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '11111111-1111-1111-1111-111111111111'::uuid $$;
   CREATE FUNCTION public.has_role(uid uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT r='admin' $$;
   CREATE TABLE public.ict_loans(borrow_photo_url text,return_photo_url text);
   CREATE TABLE storage.objects(bucket_id text,name text);
   GRANT USAGE ON SCHEMA auth,storage TO authenticated;
   GRANT SELECT ON public.ict_loans TO authenticated; GRANT SELECT,DELETE ON storage.objects TO authenticated;
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   CREATE POLICY read_test ON storage.objects FOR SELECT TO authenticated USING(true);
   INSERT INTO ict_loans VALUES('https://school/storage/v1/object/public/ict-loan-photos/borrow/used.jpg',NULL);
   INSERT INTO storage.objects VALUES('ict-loan-photos','borrow/used.jpg'),('ict-loan-photos','borrow/unused.jpg');`);
  await db.exec(readFileSync('drizzle/migrations/0061_ict_unused_evidence_cleanup.sql','utf8'));
  await db.exec(`SET ROLE authenticated; DELETE FROM storage.objects WHERE bucket_id='ict-loan-photos'`);
  expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([{name:'borrow/used.jpg'}]);
 } finally { await db.close(); }
},30000);