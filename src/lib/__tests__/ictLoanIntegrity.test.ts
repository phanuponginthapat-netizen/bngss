// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('restores admin CRUD, protects loan history and rejects borrowing unavailable equipment', async () => {
 const db = new PGlite();
 try {
  await db.exec(`
   CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.uid',true)::uuid $$;
   CREATE TYPE ict_device_status AS ENUM('available','borrowed','maintenance','lost','retired');
   CREATE TABLE user_roles(user_id uuid,role text);
   CREATE FUNCTION has_role(uid uuid,r text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=uid AND role=r) $$;
   CREATE FUNCTION _staff_check(uid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=uid AND role IN('admin','director','teacher')) $$;
   CREATE TABLE students(id uuid,auth_user_id uuid); CREATE TABLE personnel(id uuid,user_id uuid);
   CREATE TABLE ict_devices(id uuid PRIMARY KEY,status ict_device_status);
   CREATE TABLE ict_loans(id uuid PRIMARY KEY,device_id uuid REFERENCES ict_devices ON DELETE CASCADE,student_id uuid,personnel_id uuid,status text,borrowed_at timestamptz DEFAULT now(),expected_return_at timestamptz);
   ALTER TABLE ict_devices ENABLE ROW LEVEL SECURITY; ALTER TABLE ict_loans ENABLE ROW LEVEL SECURITY;
   GRANT USAGE ON SCHEMA auth TO authenticated; GRANT SELECT ON students,personnel TO authenticated;
   INSERT INTO user_roles VALUES('11111111-1111-1111-1111-111111111111','admin'),('22222222-2222-2222-2222-222222222222','student');
   SET test.uid='11111111-1111-1111-1111-111111111111';
  `);
  await db.exec(readFileSync('drizzle/migrations/0059_ict_device_loan_integrity.sql','utf8'));
  await db.exec(`SET ROLE authenticated; INSERT INTO ict_devices VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','available');`);
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
  expect((await db.query('SELECT * FROM ict_devices')).rows).toHaveLength(1);
  await expect(db.exec(`INSERT INTO ict_devices VALUES('cccccccc-cccc-cccc-cccc-cccccccccccc','available')`)).rejects.toThrow();
 } finally { await db.close(); }
},30000);