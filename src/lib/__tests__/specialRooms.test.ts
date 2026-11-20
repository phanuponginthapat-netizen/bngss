// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role service_role; create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
    create function public.has_role(uuid,text) returns boolean language sql stable as $$select current_setting('test.role') = $2$$;
    create table public.special_rooms(id int primary key, image_url text);
    create table public.room_bookings(id int primary key,room_id int constraint room_bookings_room_id_fkey references public.special_rooms(id) on delete cascade);
    create table public.learning_center_bookings(id int primary key,room_id int references public.special_rooms(id) on delete set null);
    create table storage.objects(id int primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema auth,storage to authenticated; grant select on storage.objects to authenticated;
    create policy "Special rooms readable" on public.special_rooms for select to authenticated using (true);
    insert into public.special_rooms values(1,'asset-photos/special-rooms/room.jpg');
    insert into public.room_bookings values(1,1); insert into public.learning_center_bookings values(1,1);
    insert into storage.objects values(1,'asset-photos','special-rooms/room.jpg'),(2,'asset-photos','private.jpg');`);
  await db.exec(readFileSync('drizzle/migrations/0077_restore_special_room_management.sql', 'utf8'));
  return db;
}
describe('special room management', () => {
  it.each(['admin', 'director'])('%s deletes a room while preserving both booking histories', async role => {
    const db = await fixture();
    try {
      await db.exec(`set test.role='${role}'; set role authenticated; delete from public.special_rooms where id=1; reset role;`);
      expect((await db.query('select * from public.special_rooms')).rows).toEqual([]);
      expect((await db.query('select room_id from public.room_bookings')).rows).toEqual([{room_id:null}]);
      expect((await db.query('select room_id from public.learning_center_bookings')).rows).toEqual([{room_id:null}]);
    } finally { await db.close(); }
  });
  it('does not grant teachers room deletion', async () => {
    const db = await fixture();
    try {
      await db.exec("set test.role='teacher'; set role authenticated; delete from public.special_rooms where id=1; reset role;");
      expect((await db.query('select id from public.special_rooms')).rows).toEqual([{id:1}]);
    } finally { await db.close(); }
  });
  it('reads only the saved room photo, not unrelated private files', async () => {
    const db = await fixture();
    try {
      await db.exec("set test.role='student'; set role authenticated;");
      expect((await db.query('select name from storage.objects')).rows).toEqual([{name:'special-rooms/room.jpg'}]);
    } finally { await db.close(); }
  });
});