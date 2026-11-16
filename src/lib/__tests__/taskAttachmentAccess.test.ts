// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('permits only the assigned recipient and original uploader to read exact task attachments', async () => {
  const db = new PGlite();
  const sender = '11111111-1111-1111-1111-111111111111';
  const recipient = '22222222-2222-2222-2222-222222222222';
  try {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.uid',true)::uuid $$;
      CREATE TABLE public.task_assignments(task_type text, assigned_by uuid, assigned_to_user_id uuid, attachments jsonb);
      CREATE TABLE storage.objects(bucket_id text, name text);
      GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;
      GRANT SELECT ON public.task_assignments,storage.objects TO authenticated,anon;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE POLICY uploader ON storage.objects FOR SELECT TO authenticated USING(bucket_id='task-attachments' AND split_part(name,'/',1)=auth.uid()::text);
      INSERT INTO public.task_assignments VALUES
        ('assignment','${sender}','${recipient}','[{"path":"${sender}/allowed.jpg"}]'),
        ('assignment','${sender}','${recipient}','["${sender}/legacy.jpg"]'),
        ('assignment','${sender}','${recipient}','[{"path":"other/spoof.jpg"}]');
      INSERT INTO storage.objects VALUES
        ('task-attachments','${sender}/allowed.jpg'),('task-attachments','${sender}/legacy.jpg'),
        ('task-attachments','${sender}/unattached.jpg'),('task-attachments','other/spoof.jpg'),
        ('private-other','${sender}/allowed.jpg');
    `);
    await db.exec(readFileSync('drizzle/migrations/0058_task_attachment_recipient_read.sql','utf8'));
    await db.exec(`SET test.uid='${recipient}'; SET ROLE authenticated`);
    expect((await db.query('SELECT name FROM storage.objects ORDER BY name')).rows).toEqual([{name:`${sender}/allowed.jpg`},{name:`${sender}/legacy.jpg`}]);
    await db.exec(`SET test.uid='33333333-3333-3333-3333-333333333333'`);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([]);
    await db.exec(`SET test.uid='${sender}'`);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toHaveLength(3);
    await db.exec('RESET ROLE; SET ROLE anon');
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([]);
  } finally { await db.close(); }
},30000);