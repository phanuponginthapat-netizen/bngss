// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll,afterAll,it,expect } from "vitest";
const db=new PGlite();
const student="11111111-1111-1111-1111-111111111111", parent="22222222-2222-2222-2222-222222222222", room="33333333-3333-3333-3333-333333333333";
beforeAll(async()=>{
 await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE TABLE public.students(id uuid,auth_user_id uuid,parent_user_id uuid,parent_user_id_2 uuid,classroom_id uuid);
 CREATE TABLE public.task_assignments(task_type text,assigned_to_student_id uuid,classroom_id uuid,attachments jsonb);
 CREATE TABLE storage.objects(bucket_id text,name text);
 GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon; GRANT SELECT ON public.students,public.task_assignments,storage.objects TO authenticated,anon;
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 INSERT INTO public.students VALUES('${student}','${student}','${parent}',NULL,'${room}');
 INSERT INTO public.task_assignments VALUES('homework',NULL,'${room}','[{"path":"original.jpg"}]'),('homework','${student}',NULL,'[{"path":"individual.pdf"}]'),('homework',NULL,'${parent}','[{"path":"other-room.pdf"}]'),('task',NULL,'${room}','[{"path":"not-homework.pdf"}]');
 INSERT INTO storage.objects VALUES('homework-files','original.jpg'),('homework-files','individual.pdf'),('homework-files','other-room.pdf'),('homework-files','not-homework.pdf'),('homework-files','another-answer.pdf'),('other-bucket','original.jpg');`);
 await db.exec(readFileSync("drizzle/migrations/0075_homework_family_original_files.sql","utf8"));
},30000);
afterAll(()=>db.close());
async function visible(uid:string,role="authenticated"){
 await db.exec(`RESET ROLE; SET test.uid='${uid}'; SET ROLE ${role}`);
 return (await db.query("select name from storage.objects order by name")).rows;
}
it("student reads only exact classroom and individually assigned teacher originals",async()=>expect(await visible(student)).toEqual([{name:"individual.pdf"},{name:"original.jpg"}]));
it("linked parent reads the same originals, not other answers/rooms/buckets",async()=>expect(await visible(parent)).toEqual([{name:"individual.pdf"},{name:"original.jpg"}]));
it("unlinked and anonymous accounts cannot read teacher files",async()=>{
 expect(await visible(room)).toEqual([]);expect(await visible(student,"anon")).toEqual([]);
});