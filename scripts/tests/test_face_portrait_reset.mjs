// Disposable PostgreSQL fixture; install @electric-sql/pglite outside the project.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PORTRAIT_TEST_PGLITE).href);
const db = new PGlite();
await db.exec(`
CREATE TABLE students(id uuid PRIMARY KEY,student_code text,auth_user_id uuid,photo_url text);
CREATE TABLE profiles(id uuid PRIMARY KEY,student_code text,avatar_url text,avatar_full_url text);
CREATE TABLE student_face_descriptors(student_id uuid);
CREATE TABLE face_scan_logs(student_id uuid);
CREATE TABLE face_registration_requests(student_id uuid,status text,descriptors jsonb NOT NULL,photo_urls text[] NOT NULL,review_notes text,updated_at timestamptz);
INSERT INTO students VALUES('00000000-0000-0000-0000-000000000001','1',NULL,'old');
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000002','1','old','old');
INSERT INTO student_face_descriptors VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO face_scan_logs VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO face_registration_requests VALUES('00000000-0000-0000-0000-000000000001','pending','[[1]]',ARRAY['old'],NULL,now());`);
await db.exec(readFileSync('drizzle/migrations/0054_preserve_required_pending_face_fields.sql','utf8'));
await db.exec(`CREATE TRIGGER portrait AFTER UPDATE OF photo_url ON students FOR EACH ROW EXECUTE FUNCTION invalidate_student_portrait_faces();
CREATE TRIGGER profile AFTER UPDATE OF avatar_url,avatar_full_url ON profiles FOR EACH ROW EXECUTE FUNCTION sync_profile_portrait_and_invalidate_faces();`);
await db.exec(readFileSync('scripts/tests/test_face_portrait_reset.sql','utf8').replace(/^\\set.*$/gm,''));
await db.exec(`UPDATE students SET photo_url='new';`);
const { rows }=await db.query(`SELECT status,descriptors,photo_urls FROM face_registration_requests`);
if(rows[0].status!=='cancelled'||rows[0].descriptors.length!==0||rows[0].photo_urls.length!==0)throw Error('Pending old portraits retained');
console.log('Unchanged/card/profile portrait rules, pending cancellation and evidence preservation passed');
await db.close();