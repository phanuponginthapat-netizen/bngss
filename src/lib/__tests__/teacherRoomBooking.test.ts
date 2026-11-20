// @vitest-environment node
import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
it('teachers book as themselves and cannot cancel another teacher booking or use an inactive room', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated; create role service_role; create schema auth;
    create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
    create function public.has_role(uuid,text) returns boolean language sql as $$select $2='teacher'$$;
    create function public.get_user_school_id(uuid) returns int language sql as $$select 1$$;
    create table public.personnel(id int,user_id uuid);
    create table public.special_rooms(id int,is_active boolean,school_id int);
    create table public.learning_center_bookings(id int,teacher_id int,room_id int,created_by uuid);
    grant usage on schema auth to authenticated;
    grant select on public.personnel,public.special_rooms to authenticated;
    insert into public.personnel values(1,auth.uid()); insert into public.special_rooms values(1,true,1),(2,false,1);
    insert into public.learning_center_bookings values(2,2,1,'00000000-0000-0000-0000-000000000002');
    create policy read on public.learning_center_bookings for select to authenticated using(true);`);
    await db.exec(readFileSync('drizzle/migrations/0078_restore_teacher_room_booking.sql','utf8'));
    await db.exec('set role authenticated; insert into public.learning_center_bookings values(1,1,1,auth.uid());');
    expect((await db.query('select id from public.learning_center_bookings order by id')).rows).toEqual([{id:1},{id:2}]);
    await expect(db.exec('insert into public.learning_center_bookings values(3,1,2,auth.uid());')).rejects.toThrow();
    await expect(db.exec("insert into public.learning_center_bookings values(3,1,1,'00000000-0000-0000-0000-000000000002');")).rejects.toThrow();
    await db.exec('delete from public.learning_center_bookings where id=2; delete from public.learning_center_bookings where id=1;');
    expect((await db.query('select id from public.learning_center_bookings')).rows).toEqual([{id:2}]);
  } finally { await db.close(); }
});