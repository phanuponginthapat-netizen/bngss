// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('drizzle/migrations/0029_alumni_student_roster_sync.sql', 'utf8');
const uid = '11111111-1111-4111-8111-111111111111';
async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.user_roles (user_id uuid, role text);
    CREATE TABLE public.students (id int, auth_user_id uuid, status text, classroom_id int,
      inclusion_classroom_id int, graduation_year int, graduated_at date);
    INSERT INTO public.students VALUES (1, '${uid}', 'active', 12, 14, NULL, NULL);`);
  if (process.env.TEST_LEGACY_ROSTER !== '1') await db.exec(migration);
  return db;
}
describe('alumni roster consistency', () => {
  it('removes alumni from active and both classroom rosters without fabricating graduation', async () => {
    const db = await setup();
    try {
      await db.exec(`INSERT INTO public.user_roles VALUES ('${uid}', 'alumni')`);
      expect((await db.query('SELECT status, classroom_id, inclusion_classroom_id, graduation_year, graduated_at FROM students')).rows)
        .toEqual([{ status: 'inactive', classroom_id: null, inclusion_classroom_id: null, graduation_year: null, graduated_at: null }]);
    } finally { await db.close(); }
  });
  it('preserves transferred status and prevents imports restoring alumni classroom membership', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE students SET status='transferred'; INSERT INTO user_roles VALUES ('${uid}', 'student'); UPDATE user_roles SET role='alumni';`);
      expect((await db.query('SELECT status FROM students')).rows).toEqual([{ status: 'transferred' }]);
      await db.exec("UPDATE students SET status='active', classroom_id=99, inclusion_classroom_id=98");
      expect((await db.query('SELECT status,classroom_id,inclusion_classroom_id FROM students')).rows).toEqual([{ status:'inactive', classroom_id:null, inclusion_classroom_id:null }]);
    } finally { await db.close(); }
  });
  it('keeps a currently studying student in their classroom', async () => {
    const db = await setup();
    try {
      await db.exec(`INSERT INTO user_roles VALUES ('${uid}', 'student')`);
      expect((await db.query('SELECT status,classroom_id FROM students')).rows).toEqual([{status:'active', classroom_id:12}]);
    } finally { await db.close(); }
  });
});