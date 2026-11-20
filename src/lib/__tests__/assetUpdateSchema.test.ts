import { describe,it,expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
describe('asset update schema regression',()=>{
  it('supports the existing timestamp trigger without losing asset fields',async()=>{
    const db=new PGlite();
    try {
      await db.exec(`create table public.assets(id integer primary key,asset_name text); insert into public.assets values(1,'original'); create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin NEW.updated_at=now();return NEW;end;$$; create trigger update_assets_updated_at before update on public.assets for each row execute function public.update_updated_at_column();`);
      await db.exec(readFileSync('drizzle/migrations/0076_restore_asset_update_timestamp.sql','utf8'));
      await db.exec("update public.assets set asset_name='edited' where id=1");
      const result=await db.query<{asset_name:string;has_timestamp:boolean}>('select asset_name,updated_at is not null as has_timestamp from public.assets where id=1');
      expect(result.rows).toEqual([{asset_name:'edited',has_timestamp:true}]);
    } finally {await db.close();}
  });
});