import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite }=await import(pathToFileURL(process.env.PORTRAIT_TEST_PGLITE).href);
const db=new PGlite();
await db.exec(`CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION public.has_role(uid uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT r=current_setting('test.role') $$;
CREATE TABLE profiles(id uuid,avatar_url text,avatar_full_url text,nickname text);
CREATE TABLE students(photo_url text);
INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','old','old','name');
INSERT INTO students VALUES('old');`);
await db.exec(readFileSync('drizzle/migrations/0055_block_family_portrait_changes.sql','utf8'));
for(const role of ['student','parent']){
 await db.exec(`SET test.role='${role}';`);
 for(const query of ["UPDATE profiles SET avatar_url='new'", "UPDATE profiles SET avatar_full_url='new'", "UPDATE students SET photo_url='new'"]){
  let denied=false;
  try {await db.exec(query);}catch(e){if(e.code==='42501')denied=true;else throw e;}
  if(!denied)throw Error(role+' changed portrait');
 }
 await db.exec("UPDATE profiles SET nickname='new'; UPDATE profiles SET avatar_url='old';");
 console.log(role+': portrait writes denied; unchanged portrait and other edits allowed');
}
await db.exec("SET test.role='teacher'; UPDATE profiles SET avatar_url='staff'; UPDATE students SET photo_url='staff';");
console.log('staff retain existing permitted portrait writes');
await db.close();